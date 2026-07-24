/**
 * AuthSessionContext — состояние потока входа (A1→A2→A3→A4→Main) на фикстурах.
 *
 * НЕ трогает Supabase / auth.ts / demoApi.ts / ParentDataContext /
 * DemoSessionContext — это отдельная сессионная сущность Захода 4.
 *
 * Формат — по разведке recon-aux §1.3: pipeline + phone/sms/country/kidsCount +
 * флаги isDemo/bannerClosed + действия submitPhone/verifyCode/pickChild/
 * pickDemoParent/enterApp/signOut. Всё на useState — persist на этом этапе не
 * требуется (StubScreen не даст выйти обратно).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  getChildren,
  getChildrenForDemoParent,
  getDemoParents,
  DEFAULT_CHILD_INDEX,
} from "../data";
import type { DemoParentRow } from "../data/types";

export type AuthPhase = "onboarding" | "phone" | "sms" | "childPicker" | "app";

/** Порядок фаз для навигации: индекс задаёт "глубину" в стеке. */
const PHASE_ORDER: AuthPhase[] = ["onboarding", "phone", "sms", "childPicker"];

/** Стартовый выделенный ребёнок при заходе на A4: 3 → 1 (Малика), иначе 0. */
const DEFAULT_SEL_BY_KIDS: Record<number, number> = { 1: 0, 2: 0, 3: 1 };

export interface AuthSessionState {
  phase: AuthPhase;
  /** 9 цифр без кода страны. */
  phone: string;
  /** "+998" | "+7" | "+996". */
  country: string;
  /** 0..4 цифр. */
  smsCode: string;
  /** Кто активен: демо-родитель (id из DEMO_PARENTS) или null (phone-flow). */
  demoParentId: string | null;
  /** Сколько детей у активного родителя (1..3). Phone-flow → 3 (все CHILDREN). */
  kidsCount: number;
  /** Индекс подсветки в A4. */
  authSel: number;
  /** true после выбора демо-родителя (перед enterApp). */
  isDemo: boolean;
  /** Крестик демо-баннера. */
  bannerClosed: boolean;
  /** id выбранного ребёнка после enterApp (для MainStack). */
  currentChildId: string | null;
}

export interface AuthSessionCtx extends AuthSessionState {
  setPhase(next: AuthPhase): void;
  setCountry(code: string): void;
  setPhone(digits: string): void;
  setSmsCode(code: string): void;
  setAuthSel(i: number): void;
  submitPhone(): void;
  verifyCode(): "picker" | "app";
  pickDemoParent(p: DemoParentRow): "picker" | "app";
  pickChildIndex(i: number): void;
  enterApp(childIndex: number): void;
  closeDemoBanner(): void;
  signOut(): void;
}

const AuthSessionContext = createContext<AuthSessionCtx | null>(null);

const INITIAL_STATE: AuthSessionState = {
  phase: "onboarding",
  phone: "",
  country: "+998",
  smsCode: "",
  demoParentId: null,
  kidsCount: 3,
  authSel: DEFAULT_CHILD_INDEX,
  isDemo: false,
  bannerClosed: false,
  currentChildId: null,
};

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthSessionState>(INITIAL_STATE);

  const setPhase = useCallback((next: AuthPhase) => {
    setState((s) => ({ ...s, phase: next }));
  }, []);

  const setCountry = useCallback((code: string) => {
    setState((s) => ({ ...s, country: code }));
  }, []);

  const setPhone = useCallback((digits: string) => {
    setState((s) => ({ ...s, phone: digits.replace(/\D/g, "").slice(0, 9) }));
  }, []);

  const setSmsCode = useCallback((code: string) => {
    setState((s) => ({ ...s, smsCode: code.replace(/\D/g, "").slice(0, 4) }));
  }, []);

  const setAuthSel = useCallback((i: number) => {
    setState((s) => ({ ...s, authSel: i }));
  }, []);

  const submitPhone = useCallback(() => {
    // Phone-flow: не демо. Сбрасываем smsCode, оставляем kidsCount=3 (макет так).
    setState((s) => ({ ...s, phase: "sms", smsCode: "", isDemo: false, kidsCount: 3, authSel: DEFAULT_CHILD_INDEX }));
  }, []);

  const enterApp = useCallback((childIndex: number) => {
    setState((s) => {
      // Заход 5: если это демо-родитель, берём его собственный список детей
      // (Исмаилов → Азизбек, Рахимов → Мадина/Хумоюн, Каримова → Азиз/Малика/
      //  Фаррух). Phone-flow (demoParentId == null) — прежний behavior:
      //  берём из общего пула CHILDREN.
      const kids = s.demoParentId
        ? getChildrenForDemoParent(s.demoParentId)
        : getChildren();
      const bound = Math.max(1, kids.length);
      const idx = Math.max(0, Math.min(childIndex, bound - 1));
      const childId = kids[idx]?.id ?? kids[0]?.id ?? null;
      return { ...s, phase: "app", currentChildId: childId };
    });
  }, []);

  const verifyCode = useCallback((): "picker" | "app" => {
    // В фазе smsCode.length === 4 (проверяется вызывающим). Пропуск A4 при
    // одном ребёнке (сейчас kidsCount=3, но правило зашито впрок).
    let target: "picker" | "app" = "picker";
    setState((s) => {
      if (s.kidsCount === 1) {
        target = "app";
        const kids = getChildren();
        return { ...s, phase: "app", currentChildId: kids[0]?.id ?? null };
      }
      return { ...s, phase: "childPicker" };
    });
    return target;
  }, []);

  const pickDemoParent = useCallback((p: DemoParentRow): "picker" | "app" => {
    let target: "picker" | "app" = "picker";
    setState((s) => {
      const kidsCount = p.kids_count;
      if (kidsCount === 1) {
        target = "app";
        const kids = getChildren();
        const firstId = p.child_ids[0] ?? kids[0]?.id ?? null;
        return {
          ...s,
          isDemo: true,
          bannerClosed: false,
          demoParentId: p.id,
          kidsCount,
          authSel: 0,
          phase: "app",
          currentChildId: firstId,
        };
      }
      return {
        ...s,
        isDemo: true,
        bannerClosed: false,
        demoParentId: p.id,
        kidsCount,
        authSel: DEFAULT_SEL_BY_KIDS[kidsCount] ?? 0,
        phase: "childPicker",
      };
    });
    return target;
  }, []);

  const pickChildIndex = useCallback((i: number) => {
    setState((s) => ({ ...s, authSel: i }));
  }, []);

  const closeDemoBanner = useCallback(() => {
    setState((s) => ({ ...s, bannerClosed: true }));
  }, []);

  const signOut = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const value = useMemo<AuthSessionCtx>(
    () => ({
      ...state,
      setPhase,
      setCountry,
      setPhone,
      setSmsCode,
      setAuthSel,
      submitPhone,
      verifyCode,
      pickDemoParent,
      pickChildIndex,
      enterApp,
      closeDemoBanner,
      signOut,
    }),
    [
      state,
      setPhase,
      setCountry,
      setPhone,
      setSmsCode,
      setAuthSel,
      submitPhone,
      verifyCode,
      pickDemoParent,
      pickChildIndex,
      enterApp,
      closeDemoBanner,
      signOut,
    ],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionCtx {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return ctx;
}

/** Хелпер для внешних (навигация): доступ ко всему списку родителей. */
export function getAuthDemoParents(): DemoParentRow[] {
  return getDemoParents();
}

/** Индексы фаз (для условной рендер-логики). */
export function phaseIndex(phase: AuthPhase): number {
  return PHASE_ORDER.indexOf(phase);
}
