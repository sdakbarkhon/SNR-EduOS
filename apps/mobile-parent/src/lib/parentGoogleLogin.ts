import { Linking } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { getSupabase } from "./supabase";

/**
 * Вход родителя через Google в приложении.
 *
 * ЛОГИКА ТА ЖЕ, ЧТО НА ВЕБЕ, и это важно: Google здесь не пускает в кабинет, а
 * только доказывает владение почтой. У родителя уже есть учётная запись — её
 * заводит админ, ею же он входит по телефону, и именно её user_id стоит в
 * parents.user_id, на нём держатся все правила доступа. Под учётной записью
 * Google (другой user_id) родитель увидел бы пустой кабинет.
 *
 * ПОРЯДОК:
 *   1. Просим у Supabase адрес авторизации, возврат — на схему приложения
 *      (snreduosparent://auth). Браузер открываем системный.
 *   2. Ловим возврат, меняем `code` на сессию — она принадлежит учётной
 *      записи GOOGLE.
 *   3. Несём её токен на сервер (/api/parent/google-login). Там та же самая
 *      функция сверки, что и у веба: почта нормализуется и ищется в
 *      parents.google_email. В ответ — одноразовый token_hash настоящей
 *      учётной записи родителя.
 *   4. Гасим сессию Google — в любом исходе.
 *   5. Меняем token_hash на сессию родителя и записываем её в реестр одной
 *      сессии.
 *
 * ПОЧЕМУ token_hash ИДЁТ ОТВЕТОМ НА ЗАПРОС, А НЕ В АДРЕСЕ ВОЗВРАТА. По схеме
 * приложения возвращается только `code`, который без секрета из защищённого
 * хранилища этого устройства бесполезен. Одноразовый ключ от сессии родителя
 * так не передаётся намеренно: свою схему на Android может зарегистрировать
 * любое приложение, и такой переход можно перехватить.
 *
 * НОВЫХ НАТИВНЫХ МОДУЛЕЙ НЕ ТРЕБУЕТСЯ: Linking входит в react-native,
 * expo-constants уже стоит.
 */

const RETURN_URL = "snreduosparent://auth";

/** Причины отказа — те же четыре, что на вебе, плюс местные. */
export type GoogleLoginError =
  | "demo_school"       // почта ведёт в демо-школу: туда только по кнопке «Демо»
  | "not_linked"        // почта не привязана ни к одному родителю
  | "no_account"        // почта совпала, учётной записи у родителя нет
  | "school_archived"   // школа в архиве
  | "failed"            // техническая ошибка
  | "cancelled"         // человек нажал «Отмена» у Google — молча
  | "expo_go"           // Expo Go не умеет возвращаться по схеме приложения
  | "config_error";     // сборка без webApiBaseUrl

export class GoogleLoginFailure extends Error {
  constructor(public reason: GoogleLoginError) {
    super(reason);
  }
}

type ExpoExtra = { webApiBaseUrl?: string };

function baseUrl(): string {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  if (!extra?.webApiBaseUrl) throw new GoogleLoginFailure("config_error");
  return extra.webApiBaseUrl;
}

/**
 * Expo Go живёт на схеме exp://, свою схему приложения он не регистрирует
 * (документация Expo, раздел Linking into your app). Значит возврат из
 * браузера туда не придёт, и звать Google бессмысленно — честнее сказать.
 */
export function isGoogleLoginAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/** Ждём возврата по схеме приложения. Слушателя снимаем в любом исходе. */
function waitForReturn(timeoutMs = 5 * 60 * 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.remove();
      fn();
    };
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(RETURN_URL)) finish(() => resolve(url));
    });
    const timer = setTimeout(
      () => finish(() => reject(new GoogleLoginFailure("cancelled"))),
      timeoutMs,
    );
  });
}

/**
 * Разбор параметров адреса вручную. URLSearchParams в React Native есть, но
 * это неполный полифил — на нём завязываться не стоит ради двух параметров.
 */
function paramOf(url: string, name: string): string | null {
  const q = url.indexOf("?");
  if (q < 0) return null;
  for (const pair of url.slice(q + 1).split("&")) {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    if (decodeURIComponent(key) !== name) continue;
    return eq < 0 ? "" : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
  }
  return null;
}

/**
 * Полный вход. Бросает GoogleLoginFailure с причиной — экран переводит её на
 * язык человека готовыми строками (те же, что на вебе).
 */
export async function loginParentWithGoogle(): Promise<void> {
  if (!isGoogleLoginAvailable()) throw new GoogleLoginFailure("expo_go");

  const db = getSupabase();
  const api = baseUrl();

  // 1. Адрес авторизации. skipBrowserRedirect — потому что переходом
  //    управляем мы сами: на устройстве нет window.location.
  const { data: start, error: startErr } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: RETURN_URL,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (startErr || !start?.url) throw new GoogleLoginFailure("failed");

  // 2. Открываем браузер и ждём возврата.
  const waiting = waitForReturn();
  const opened = await Linking.openURL(start.url).then(() => true).catch(() => false);
  if (!opened) throw new GoogleLoginFailure("failed");

  const returned = await waiting;
  if (paramOf(returned, "error")) throw new GoogleLoginFailure("cancelled");
  const code = paramOf(returned, "code");
  if (!code) throw new GoogleLoginFailure("failed");

  // 3. Код → сессия учётной записи GOOGLE.
  const { data: googleSession, error: exchangeErr } = await db.auth.exchangeCodeForSession(code);
  const googleToken = googleSession?.session?.access_token;
  if (exchangeErr || !googleToken) throw new GoogleLoginFailure("failed");

  // 4. Сверка почты на сервере — та же функция, что у веба.
  let tokenHash: string | null = null;
  let reason: GoogleLoginError = "failed";
  try {
    const res = await fetch(`${api}/api/parent/google-login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as { tokenHash?: string; error?: string };
    if (res.ok && json.tokenHash) tokenHash = json.tokenHash;
    else if (json.error && ["not_linked", "no_account", "school_archived", "demo_school"].includes(json.error)) {
      reason = json.error as GoogleLoginError;
    }
  } catch {
    reason = "failed";
  }

  // 5. Сессию Google гасим в любом исходе — под ней родителю делать нечего.
  await db.auth.signOut().catch(() => undefined);

  if (!tokenHash) throw new GoogleLoginFailure(reason);

  // 6. token_hash → сессия НАСТОЯЩЕЙ учётной записи родителя.
  const { data: session, error: otpErr } = await db.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  const parentToken = session?.session?.access_token;
  if (otpErr || !session?.user || !parentToken) throw new GoogleLoginFailure("failed");

  // 7. Реестр одной сессии. Не прошло — вход не засчитываем: лучше отказ, чем
  //    сессия в обход защиты (так же поступает веб).
  try {
    const res = await fetch(`${api}/api/parent/register-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    if (!res.ok) throw new Error("register failed");
  } catch {
    await db.auth.signOut().catch(() => undefined);
    throw new GoogleLoginFailure("failed");
  }
}
