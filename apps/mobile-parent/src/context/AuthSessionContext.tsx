/**
 * AuthSessionContext — состояние потока входа (A1→A2→A3→A4→Main).
 *
 * ЗАХОД 1 (реальный вход): submitPhone/verifyCode для phone-flow (не демо)
 * больше не чистая фикстура — резолвят один из 3 тестовых номеров
 * (src/lib/testAccounts.ts) в реальный parent-аккаунт и реально логинят
 * через loginAsParent() (lib/auth.ts, "осиротевшая" после Захода 4 v2-
 * редизайна обвязка — теперь снова в деле). Настоящая Supabase-сессия
 * живёт в expo-secure-store (lib/supabase.ts), эта сессия — просто UI-
 * состояние потока экранов, никакого persist не требует.
 *
 * ЗАХОД 5x (правка 3): жёлтый DemoBannerGlass поверх шапки заменён на
 * one-shot центр-модалку `DemoNoticeModal` (см. RootNavigator + src/ui).
 * Прежние `bannerClosed`/`closeDemoBanner` переименованы в
 * `demoNoticeSeen`/`dismissDemoNotice`. Флаг session-scoped — сбрасывается
 * в false при демо-тапе (performLogin(isDemoTap=true)) и в signOut (сброс
 * всей сессии). При phone-flow (не демо) модалка не показывается никогда.
 *
 * Долги, проход 1: pickDemoParent()/DEMO_PARENTS/getChildrenForDemoParent
 * удалены — были мёртвым кодом (не вызывались ни из одного UI-пути с
 * Захода 2, шаг 2, когда AuthDemoPickerSheet переписали на реальный
 * loginAsTestAccount()). Поле demoParentId в состоянии осталось — на него
 * по-прежнему завязан isRealFlow-гейт во всех data-экранах.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { getChildren, DEFAULT_CHILD_INDEX } from "../data";
import { loginAsParent } from "../lib/auth";
import { getSupabase } from "../lib/supabase";
import { findTestAccount, TEST_ACCOUNT_PASSWORD, type TestAccount } from "../lib/testAccounts";
import { useParentData } from "./ParentDataContext";

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
  /** id демо-родителя, если активна демо-сессия, или null (phone-flow).
   *  Устанавливается только через performLogin(isDemoTap=true). */
  demoParentId: string | null;
  /** Сколько детей у активного родителя (1..3). Заход 1: для phone-flow
   *  теперь реальное число из lib/testAccounts.ts (было — хардкод 3). */
  kidsCount: number;
  /** Индекс подсветки в A4. */
  authSel: number;
  /** true после выбора демо-родителя (перед enterApp). */
  isDemo: boolean;
  /** ЗАХОД 5x (правка 3): true после того, как one-shot центр-модалка
   *  «Демо-режим» (DemoNoticeModal) закрыта. Session-scoped: при новом
   *  демо-тапе (performLogin(isDemoTap=true)) и при signOut сбрасывается
   *  обратно в false. */
  demoNoticeSeen: boolean;
  /** id выбранного ребёнка после enterApp (для MainStack). */
  currentChildId: string | null;
  /** Заход 1: ошибка на экране телефона — ключ в d.parentApp.auth, не
   *  готовая строка (иначе не переживёт смену языка на лету). */
  phoneError: "phoneNotFound" | null;
  /** Заход 1: ошибка на экране кода — ключ в d.parentApp.auth. Заход 2, шаг
   *  2: "wrongCode" больше не встречается (код не проверяется), но тип
   *  оставлен на будущее — оставлен только "loginFailed". */
  smsError: "loginFailed" | null;
  /** Заход 1: идёт реальный сетевой логин (signInWithPassword) — блокирует
   *  повторный сабмит кода, пока первый запрос ещё в полёте. */
  authBusy: boolean;
  /** Заход 1: username реального аккаунта, найденного submitPhone по номеру —
   *  используется verifyCode() после совпадения кода. null вне phone-flow. */
  pendingUsername: string | null;
  /** Заход 1: фикстурные id детей (lib/testAccounts.ts) — подставляются как
   *  currentChildId после реального логина, т.к. остальные (пока фикстурные)
   *  экраны данных ещё не понимают настоящие student_id из Supabase. */
  pendingFixtureChildIds: string[] | null;
}

export interface AuthSessionCtx extends AuthSessionState {
  setPhase(next: AuthPhase): void;
  setCountry(code: string): void;
  setPhone(digits: string): void;
  setSmsCode(code: string): void;
  setAuthSel(i: number): void;
  submitPhone(): void;
  verifyCode(): Promise<"picker" | "app" | "error">;
  /** Заход 2, шаг 2: демо-модалка — тап по карточке родителя сразу делает
   *  реальный вход этим аккаунтом (без экрана кода). */
  loginAsTestAccount(account: TestAccount): Promise<"picker" | "app" | "error">;
  pickChildIndex(i: number): void;
  enterApp(childIndex: number): void;
  /** ЗАХОД 5x (правка 3): закрыть one-shot центр-модалку «Демо-режим». */
  dismissDemoNotice(): void;
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
  demoNoticeSeen: false,
  currentChildId: null,
  phoneError: null,
  smsError: null,
  authBusy: false,
  pendingUsername: null,
  pendingFixtureChildIds: null,
};

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthSessionState>(INITIAL_STATE);
  // Заход 1: verifyCode() — async, но должен читать САМЫЙ СВЕЖИЙ state
  // (smsCode/pendingCode) синхронно в момент вызова, а не то, что было
  // захвачено замыканием при последнем создании useCallback. Ref
  // обновляется на каждом рендере — дешевле и надёжнее, чем городить
  // доп. useEffect ради синхронизации.
  const stateRef = useRef(state);
  stateRef.current = state;
  const { data: parentData, refresh: refreshParentData, selectChild: selectParentChild } = useParentData();
  // Тот же приём, что и stateRef — verifyCode() читает это ПОСЛЕ await
  // refreshParentData(), поэтому нужен самый свежий parentData, а не тот,
  // что был захвачен замыканием при последнем создании useCallback.
  const parentDataRef = useRef(parentData);
  parentDataRef.current = parentData;
  // Заход 2, шаг 2: синхронный guard против гонки в performLogin() — authBusy
  // (React state) коммитится только на СЛЕДУЮЩЕМ рендере, поэтому два тапа
  // по разным карточкам демо-модалки (или тап + почти одновременный
  // auto-submit кода) физически успевшие стартовать ДО первого коммита оба
  // читают authBusy===false и оба вызвали бы performLogin() параллельно —
  // два одновременных signInWithPassword на одном Supabase-клиенте, финальная
  // сессия/parentData не гарантированно от одного и того же аккаунта.
  // Найдено адверсариальной проверкой. Ref читается/пишется синхронно —
  // второй вызов в том же тике гарантированно увидит true.
  const performLoginBusyRef = useRef(false);

  const setPhase = useCallback((next: AuthPhase) => {
    setState((s) => ({ ...s, phase: next }));
  }, []);

  const setCountry = useCallback((code: string) => {
    setState((s) => ({ ...s, country: code }));
  }, []);

  const setPhone = useCallback((digits: string) => {
    // phoneError гасим при любом редактировании — иначе "Номер не найден"
    // виснет и после того, как пользователь начал вводить другой номер.
    setState((s) => ({ ...s, phone: digits.replace(/\D/g, "").slice(0, 9), phoneError: null }));
  }, []);

  const setSmsCode = useCallback((code: string) => {
    setState((s) => ({ ...s, smsCode: code.replace(/\D/g, "").slice(0, 4), smsError: null }));
  }, []);

  const setAuthSel = useCallback((i: number) => {
    setState((s) => ({ ...s, authSel: i }));
  }, []);

  const submitPhone = useCallback(() => {
    setState((s) => {
      const account = findTestAccount(s.phone);
      if (!account) {
        return { ...s, phoneError: "phoneNotFound" };
      }
      return {
        ...s,
        phase: "sms",
        smsCode: "",
        smsError: null,
        phoneError: null,
        isDemo: false,
        demoParentId: null,
        kidsCount: account.fixtureChildIds.length,
        authSel: DEFAULT_SEL_BY_KIDS[account.fixtureChildIds.length] ?? 0,
        pendingUsername: account.username,
        pendingFixtureChildIds: account.fixtureChildIds,
      };
    });
  }, []);

  const enterApp = useCallback((childIndex: number) => {
    setState((s) => {
      // Заход 1: реальный phone-login — фикстурный набор, подобранный по
      // количеству под этот тестовый аккаунт (lib/testAccounts.ts), НЕ
      // общий пул getChildren() (иначе индекс из РЕАЛЬНОГО picker'а
      // указывал бы на случайного ребёнка из всех 6 фикстурных). Пустой
      // pendingFixtureChildIds — безусловный fallback на getChildren() (не
      // должно происходить в норме, оставлен только как защита от
      // несогласованного состояния).
      const kids = s.pendingFixtureChildIds && s.pendingFixtureChildIds.length > 0
        ? s.pendingFixtureChildIds.map((id) => getChildren().find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c)
        : getChildren();
      const bound = Math.max(1, kids.length);
      const idx = Math.max(0, Math.min(childIndex, bound - 1));
      const childId = kids[idx]?.id ?? kids[0]?.id ?? null;
      return { ...s, phase: "app", currentChildId: childId };
    });
  }, []);

  // Заход 2, шаг 2: ядро реального логина, общее для двух входов — экран
  // кода (после ЛЮБЫХ 4 цифр, код больше не сверяется) и тап по карточке
  // демо-модалки (сразу, без экрана кода вообще). isDemoTap только влияет
  // на демо-специфичные косметические поля (isDemo/demoNoticeSeen для
  // one-shot центр-модалки «Демо-режим») — сам логин, RLS и дальнейшее
  // ветвление picker/app идентичны для обоих входов.
  const performLogin = useCallback(
    async (username: string, fixtureChildIds: string[], isDemoTap: boolean): Promise<"picker" | "app" | "error"> => {
      if (performLoginBusyRef.current) return "error";
      performLoginBusyRef.current = true;
      try {
        setState((s) => ({
          ...s,
          smsError: null,
          authBusy: true,
          isDemo: isDemoTap,
          demoNoticeSeen: isDemoTap ? false : s.demoNoticeSeen,
          demoParentId: null,
          pendingUsername: username,
          pendingFixtureChildIds: fixtureChildIds,
          kidsCount: fixtureChildIds.length,
          authSel: DEFAULT_SEL_BY_KIDS[fixtureChildIds.length] ?? 0,
        }));
        try {
          await loginAsParent(username, TEST_ACCOUNT_PASSWORD);
        } catch (e) {
          console.error("[AuthSessionContext] performLogin: loginAsParent failed:", e);
          setState((s) => ({ ...s, authBusy: false, smsError: "loginFailed" }));
          return "error";
        }
        // Настоящая Supabase-сессия установлена — ParentDataProvider должен
        // перезапросить getParentContext() (он смонтирован выше в дереве и на
        // самом первом, ещё неавторизованном рендере получил data:null). Ждём
        // здесь (не fire-and-forget), чтобы childPicker монтировался УЖЕ с
        // реальным списком детей — без секундного мелькания старых фикстур,
        // пока запрос в полёте.
        await refreshParentData();
        // Diagnostic-only: fixtureChildIds в testAccounts.ts подобраны под
        // РЕАЛЬНОЕ сегодняшнее число детей каждой тестовой семьи вручную —
        // если база уйдёт вперёд (админ добавит/уберёт ребёнка одному из 3
        // тестовых родителей), enterApp() ниже по коду молча смаппит выбранного
        // в picker'е (реального) ребёнка на неверный фикстурный индекс. Не
        // фиксим здесь (это будущая работа над data-экранами), просто не даём
        // такому расхождению проходить незамеченным.
        const realCount = parentDataRef.current?.children.length;
        if (realCount != null && realCount !== fixtureChildIds.length) {
          console.warn(
            `[AuthSessionContext] performLogin: реальное число детей (${realCount}) не совпадает с testAccounts.ts (${fixtureChildIds.length}) для ${username} — childPicker покажет реальных детей, но выбор смаппится на фикстуры неверно.`,
          );
        }
        if (fixtureChildIds.length <= 1) {
          setState((s) => ({ ...s, authBusy: false, phase: "app", currentChildId: fixtureChildIds[0] ?? null }));
          return "app";
        }
        setState((s) => ({ ...s, authBusy: false, phase: "childPicker" }));
        return "picker";
      } finally {
        performLoginBusyRef.current = false;
      }
    },
    [refreshParentData],
  );

  const verifyCode = useCallback(async (): Promise<"picker" | "app" | "error"> => {
    // Заход 2, шаг 2: конкретный код больше не проверяется — ЛЮБЫЕ 4 цифры
    // ведут к реальному логину. Мягкая валидация длины дублирует то, что
    // уже гарантирует вызывающая сторона (LoginSmsScreen вызывает verifyCode
    // только при smsCode.length===SMS_LEN) — оставлена как defensive-guard,
    // без отдельного сообщения об ошибке (его больше нет по смыслу).
    const { smsCode, pendingUsername, pendingFixtureChildIds } = stateRef.current;
    if (smsCode.length !== 4 || !pendingUsername) return "error";
    return performLogin(pendingUsername, pendingFixtureChildIds ?? [], false);
  }, [performLogin]);

  const loginAsTestAccount = useCallback(
    (account: TestAccount): Promise<"picker" | "app" | "error"> =>
      performLogin(account.username, account.fixtureChildIds, true),
    [performLogin],
  );

  const pickChildIndex = useCallback((i: number) => {
    setState((s) => ({ ...s, authSel: i }));
  }, []);

  const dismissDemoNotice = useCallback(() => {
    setState((s) => ({ ...s, demoNoticeSeen: true }));
  }, []);

  const signOut = useCallback(() => {
    // Заход 1: если был реальный логин, реально закрываем и Supabase-сессию
    // (иначе secure-store продолжает хранить валидный access/refresh token
    // после того, как UI уже "вышел"). Best-effort, не блокирует UI —
    // локальный сброс ниже происходит немедленно вне зависимости от сети.
    // НЕ путать с web's registerSession()/user_sessions — этого нет и не
    // добавляется (мобилка намеренно вне контура single-session).
    getSupabase().auth.signOut().catch((e) => {
      console.error("[AuthSessionContext] signOut: supabase signOut failed:", e);
    });
    // Заход 2, шаг 1: ParentDataProvider смонтирован ВЫШЕ и не размонтируется
    // вместе с этим сбросом — без явного selectChild(null) selectedChildId
    // пережил бы signOut и указывал бы на ребёнка ПРЕЖНЕЙ семьи при входе
    // под другим тестовым номером в той же живой сессии приложения (найдено
    // адверсариальной проверкой). null — auto-select useEffect в
    // ParentDataContext сам переизберёт первого ребёнка НОВОЙ семьи, как
    // только refreshParentData() отработает при следующем логине.
    selectParentChild(null);
    setState(INITIAL_STATE);
  }, [selectParentChild]);

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
      loginAsTestAccount,
      pickChildIndex,
      enterApp,
      dismissDemoNotice,
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
      loginAsTestAccount,
      pickChildIndex,
      enterApp,
      dismissDemoNotice,
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

/** Индексы фаз (для условной рендер-логики). */
export function phaseIndex(phase: AuthPhase): number {
  return PHASE_ORDER.indexOf(phase);
}
