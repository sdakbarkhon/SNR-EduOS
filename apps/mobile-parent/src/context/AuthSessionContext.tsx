/**
 * AuthSessionContext — состояние потока входа (A1→A2→A3→A4→Main).
 *
 * НАСТОЯЩИЙ ВХОД ПО ТЕЛЕФОНУ. До этого захода поток был декоративным: номер
 * искался в карте трёх тестовых номеров (lib/testAccounts.ts), пароль у всех
 * был один и лежал открытым текстом, а код из SMS не проверялся — подходили
 * ЛЮБЫЕ четыре цифры. Знание девяти цифр давало вход в чужой кабинет.
 *
 * Теперь submitPhone просит сервер выслать код на номер, а verifyCode
 * проверяет его по-настоящему (срок жизни, лимит попыток, одноразовость) —
 * тот же механизм, что на вебе после ec41048, через /api/parent/*.
 *
 * ДЕМО-ВХОД УДАЛЁН целиком (решение заказчика): приложение только для
 * настоящих родителей. Вместе с ним ушли AuthDemoPickerSheet,
 * loginAsTestAccount и карта номеров. Поле isDemo осталось константой false
 * — на него завязан RootNavigator, и убирать его отсюда значило бы трогать
 * навигацию ради мёртвой ветки.
 *
 * Дети берутся из настоящей привязки родителя (getParentContext через
 * ParentDataContext), а не из фикстурного набора, подобранного по количеству.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getChildren, DEFAULT_CHILD_INDEX } from "../data";
import { getSupabase } from "../lib/supabase";
import { claimDemoParent } from "../lib/demoApi";
import { NotParentError } from "../lib/auth";
import { PhoneLoginFailure, requestPhoneCode, verifyPhoneCode, type PhoneLoginError } from "../lib/parentPhoneLogin";
import { GoogleLoginFailure, loginParentWithGoogle, type GoogleLoginError } from "../lib/parentGoogleLogin";
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
  /** Причина отказа на шаге номера. Пришла с сервера (кроме invalidPhone —
   *  это локальная проверка длины). */
  phoneError: PhoneLoginError | "invalidPhone" | null;
  /** Заход 1: ошибка на экране кода — ключ в d.parentApp.auth. Заход 2, шаг
   *  2: "wrongCode" больше не встречается (код не проверяется), но тип
   *  оставлен на будущее — оставлен только "loginFailed". */
  smsError: "loginFailed" | "wrongCode" | "expired" | "tooMany" | null;
  /** Заход 1: идёт реальный сетевой логин (signInWithPassword) — блокирует
   *  повторный сабмит кода, пока первый запрос ещё в полёте. */
  authBusy: boolean;
  /** Заход 1: username реального аккаунта, найденного submitPhone по номеру —
   *  используется verifyCode() после совпадения кода. null вне phone-flow. */
  /** Номер, на который выслан код (девять цифр). null вне phone-flow. */
  pendingPhone: string | null;
  /** Дошла ли доставка. Пока провайдера нет — всегда false, и экран кода
   *  честно говорит, что код надо взять у школы. */
  codeDelivered: boolean;
  /** Сколько попыток осталось у кода. null — пока не пробовали. */
  smsAttemptsLeft: number | null;
  /** Код подошёл: экран показывает подтверждение, фаза переключится следом. */
  smsOk: boolean;
  /** Причина отказа при входе через Google. Машинный код, экран переводит. */
  googleError: GoogleLoginError | null;
  /** Идёт вход через Google — кнопка заблокирована, пока не вернёмся. */
  googleBusy: boolean;
  demoBusy: boolean;
}

export interface AuthSessionCtx extends AuthSessionState {
  setPhase(next: AuthPhase): void;
  setCountry(code: string): void;
  setPhone(digits: string): void;
  setSmsCode(code: string): void;
  setAuthSel(i: number): void;
  /** Просит сервер выслать код на введённый номер. */
  submitPhone(): Promise<boolean>;
  /** Повторная выдача кода — сервер сам не даёт чаще раза в минуту. */
  resendCode(): Promise<boolean>;
  verifyCode(): Promise<"picker" | "app" | "error">;
  /** Вход через Google. Тот же хвост, что у verifyCode: сессия → дети → фаза. */
  signInWithGoogle(): Promise<"picker" | "app" | "error">;
  /** Демо-вход родителем. Тот же хвост, что у Google: сессия → дети → фаза. */
  signInAsDemo(): Promise<"picker" | "app" | "error">;
  pickChildIndex(i: number): void;
  enterApp(childIndex: number): void;
  /** ЗАХОД 5x (правка 3): закрыть one-shot центр-модалку «Демо-режим». */
  dismissDemoNotice(): void;
  signOut(): void;
}

/** Сколько держим «Код принят» перед переходом. */
const SUCCESS_HOLD_MS = 450;

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
  demoBusy: false,
  currentChildId: null,
  phoneError: null,
  smsError: null,
  authBusy: false,
  pendingPhone: null,
  codeDelivered: false,
  smsAttemptsLeft: null,
  smsOk: false,
  googleError: null,
  googleBusy: false,
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
  const verifyBusyRef = useRef(false);
  const googleBusyRef = useRef(false);
  // Тот же приём, что у verifyBusyRef: authBusy — это React state, он
  // коммитится только на СЛЕДУЮЩЕМ рендере. Три быстрых нажатия по
  // «Продолжить» все три читали authBusy===false и уходили тремя запросами —
  // а сервер не даёт код чаще раза в минуту, так что второй и третий
  // возвращали «слишком часто» и затирали успех первого. Ref читается и
  // пишется синхронно: второй вызов в том же тике уже видит true.
  const requestBusyRef = useRef(false);

  // Сессия могла кончиться не по нашей воле: её закрыли с другого устройства
  // на экране «Активные сессии» (миграция 199 удаляет строку auth.sessions
  // вместе с refresh-токенами) или она протухла сама. Supabase в этом случае
  // не может продлить вход, стирает сессию и присылает SIGNED_OUT.
  //
  // Раньше приложение этого не слышало вовсе: экраны оставались на месте и
  // начинали молча отдавать ошибки — человек видел «не удалось загрузить»
  // вместо честного «войдите заново». Теперь SIGNED_OUT возвращает на вход
  // тем же сбросом, что и кнопка «Выйти».
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      // Вход через Google сам гасит промежуточную сессию Google посреди пути
      // (см. lib/parentGoogleLogin.ts, шаг 5). Это НЕ конец сессии родителя, и
      // сбрасывать состояние здесь нельзя — иначе человека выкинет на
      // онбординг ровно в тот момент, когда он входит. Состоянием на это время
      // распоряжается signInWithGoogle.
      if (googleBusyRef.current) return;
      // Свой выход уже сбросил состояние — второй сброс не навредит, но и не
      // нужен: на фазе onboarding делать нечего.
      setState((prev) => (prev.phase === "onboarding" ? prev : INITIAL_STATE));
      selectParentChild(null);
    });
    return () => data.subscription.unsubscribe();
  }, [selectParentChild]);

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

  /** Просит сервер выслать код. Номер, которого нет в базе, честно получает
   *  «не найден»: родителей заводит админ, это не публичная регистрация. */
  const requestFor = useCallback(async (digits: string): Promise<boolean> => {
    if (requestBusyRef.current) return false;
    requestBusyRef.current = true;
    setState((s) => ({ ...s, authBusy: true, phoneError: null, smsError: null }));
    try {
      const { delivered } = await requestPhoneCode(digits);
      setState((s) => ({ ...s, authBusy: false, pendingPhone: digits, codeDelivered: delivered }));
      return true;
    } catch (e) {
      const reason = e instanceof PhoneLoginFailure ? e.reason : "network_error";
      setState((s) => ({ ...s, authBusy: false, phoneError: reason }));
      return false;
    } finally {
      requestBusyRef.current = false;
    }
  }, []);

  const submitPhone = useCallback(async (): Promise<boolean> => {
    const digits = stateRef.current.phone;
    if (digits.length !== 9) {
      setState((s) => ({ ...s, phoneError: "invalidPhone" }));
      return false;
    }
    const ok = await requestFor(digits);
    if (ok) setState((s) => ({ ...s, phase: "sms", smsCode: "", smsError: null }));
    return ok;
  }, [requestFor]);

  const resendCode = useCallback(async (): Promise<boolean> => {
    const digits = stateRef.current.pendingPhone ?? stateRef.current.phone;
    return digits.length === 9 ? requestFor(digits) : false;
  }, [requestFor]);

  /** Выбор ребёнка в picker. Дети — НАСТОЯЩИЕ (getParentContext через
   *  ParentDataContext), а не фикстурный набор, подобранный по количеству:
   *  раньше индекс из реального picker-экрана маппился на фикстуру и мог
   *  указать на чужого ребёнка. Фикстуры остались запасным вариантом на
   *  случай, когда привязок нет вовсе. */
  const enterApp = useCallback((childIndex: number) => {
    const real = parentDataRef.current?.children ?? [];
    setState((s) => {
      const ids = real.length > 0 ? real.map((c) => c.id) : getChildren().map((c) => c.id);
      const idx = Math.max(0, Math.min(childIndex, Math.max(0, ids.length - 1)));
      return { ...s, phase: "app", currentChildId: ids[idx] ?? null };
    });
  }, []);

  /** Проверяет код по-настоящему и входит. Раньше здесь ЛЮБЫЕ четыре цифры
   *  вели к логину под общим паролем — код не сверялся вовсе. */
  const verifyCode = useCallback(async (): Promise<"picker" | "app" | "error"> => {
    const { smsCode, pendingPhone } = stateRef.current;
    if (smsCode.length !== 4 || !pendingPhone) return "error";
    if (verifyBusyRef.current) return "error";
    verifyBusyRef.current = true;
    setState((s) => ({ ...s, authBusy: true, smsError: null }));
    try {
      try {
        await verifyPhoneCode(pendingPhone, smsCode);
      } catch (e) {
        const reason = e instanceof PhoneLoginFailure ? e.reason : null;
        const smsError =
          reason === "wrong_code" ? ("wrongCode" as const)
            : reason === "expired" ? ("expired" as const)
              : reason === "too_many" ? ("tooMany" as const)
                : ("loginFailed" as const);
        if (!(e instanceof PhoneLoginFailure) && !(e instanceof NotParentError)) {
          console.error("[AuthSessionContext] verifyCode: неожиданная ошибка:", e);
        }
        const attemptsLeft =
          e instanceof PhoneLoginFailure && typeof e.attemptsLeft === "number"
            ? e.attemptsLeft
            : reason === "too_many" ? 0 : null;
        setState((s) => ({
          ...s,
          authBusy: false,
          smsError,
          smsAttemptsLeft: attemptsLeft ?? s.smsAttemptsLeft,
          // Поле чистим сразу: человек набирает заново, не стирая руками, и
          // автоотправка не может выстрелить второй раз по тому же коду.
          smsCode: "",
        }));
        return "error";
      }
      // Сессия установлена — ParentDataProvider должен перезапросить
      // getParentContext(): picker обязан смонтироваться уже с настоящими
      // детьми, без мелькания старых данных.
      await refreshParentData();
      const kids = parentDataRef.current?.children ?? [];
      setState((s) => ({
        ...s,
        authBusy: false,
        smsOk: true,
        smsAttemptsLeft: null,
        kidsCount: kids.length,
        authSel: DEFAULT_SEL_BY_KIDS[kids.length] ?? 0,
      }));
      // Короткая пауза, чтобы человек увидел, что код принят, а не гадал,
      // почему экран моргнул. Держим её маленькой — люди ждут входа.
      await new Promise((r) => setTimeout(r, SUCCESS_HOLD_MS));
      if (kids.length <= 1) {
        setState((s) => ({ ...s, smsOk: false, phase: "app", currentChildId: kids[0]?.id ?? null }));
        return "app";
      }
      setState((s) => ({ ...s, smsOk: false, phase: "childPicker" }));
      return "picker";
    } finally {
      verifyBusyRef.current = false;
    }
  }, [refreshParentData]);

  /**
   * Вход через Google. Хвост после успеха — тот же, что у verifyCode: сессия
   * уже установлена, надо перезапросить детей и выбрать фазу. Дублировать
   * этот кусок нельзя, поэтому он вынесен в enterAfterSession ниже.
   */
  const demoBusyRef = useRef(false);

  const signInWithGoogle = useCallback(async (): Promise<"picker" | "app" | "error"> => {
    if (googleBusyRef.current) return "error";
    googleBusyRef.current = true;
    setState((s) => ({ ...s, googleBusy: true, googleError: null }));
    try {
      try {
        await loginParentWithGoogle();
      } catch (e) {
        const reason: GoogleLoginError =
          e instanceof GoogleLoginFailure ? e.reason : "failed";
        if (!(e instanceof GoogleLoginFailure)) {
          console.error("[AuthSessionContext] signInWithGoogle: неожиданная ошибка:", e);
        }
        setState((s) => ({
          ...s,
          googleBusy: false,
          // «Отмена» у Google — не ошибка, показывать нечего.
          googleError: reason === "cancelled" ? null : reason,
        }));
        return "error";
      }
      await refreshParentData();
      const kids = parentDataRef.current?.children ?? [];
      setState((s) => ({
        ...s,
        googleBusy: false,
        kidsCount: kids.length,
        authSel: DEFAULT_SEL_BY_KIDS[kids.length] ?? 0,
      }));
      if (kids.length <= 1) {
        setState((s) => ({ ...s, phase: "app", currentChildId: kids[0]?.id ?? null }));
        return "app";
      }
      setState((s) => ({ ...s, phase: "childPicker" }));
      return "picker";
    } finally {
      googleBusyRef.current = false;
    }
  }, [refreshParentData]);

  /**
   * Демо-вход родителем.
   *
   * Слот берёт та же серверная функция claim_demo_slot, что и кнопка «Демо» на
   * вебе; отличие ровно одно — куда положить сессию. Сервер входит сам и
   * отдаёт токены, приложение кладёт их через setSession.
   *
   * Хвост после успеха тот же, что у входа через Google и по коду: перечитать
   * детей и выбрать фазу. Дублировать его нельзя, поэтому шаги те же самые.
   *
   * Защиту одной сессии не задевает: демо-вход не регистрируется в
   * user_sessions — как и на вебе.
   */
  const signInAsDemo = useCallback(async (): Promise<"picker" | "app" | "error"> => {
    if (demoBusyRef.current) return "error";
    demoBusyRef.current = true;
    setState((s) => ({ ...s, demoBusy: true }));
    try {
      const claimed = await claimDemoParent();
      if (!claimed || "error" in claimed) {
        console.error("[AuthSessionContext] демо-слот не выдан:", claimed && "error" in claimed ? claimed.error : "нет ответа");
        setState((s) => ({ ...s, demoBusy: false }));
        return "error";
      }

      const { error } = await getSupabase().auth.setSession({
        access_token: claimed.access_token,
        refresh_token: claimed.refresh_token,
      });
      if (error) {
        console.error("[AuthSessionContext] setSession не принял токены демо:", error.message);
        setState((s) => ({ ...s, demoBusy: false }));
        return "error";
      }

      await refreshParentData();
      const kids = parentDataRef.current?.children ?? [];
      setState((s) => ({
        ...s,
        demoBusy: false,
        kidsCount: kids.length,
        authSel: DEFAULT_SEL_BY_KIDS[kids.length] ?? 0,
      }));
      if (kids.length <= 1) {
        setState((s) => ({ ...s, phase: "app", currentChildId: kids[0]?.id ?? null }));
        return "app";
      }
      setState((s) => ({ ...s, phase: "childPicker" }));
      return "picker";
    } finally {
      demoBusyRef.current = false;
    }
  }, [refreshParentData]);

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
      resendCode,
      verifyCode,
      signInWithGoogle,
      signInAsDemo,
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
      resendCode,
      verifyCode,
      signInWithGoogle,
      signInAsDemo,
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
