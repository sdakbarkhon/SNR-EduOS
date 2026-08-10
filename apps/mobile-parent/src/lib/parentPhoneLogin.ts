import Constants from "expo-constants";
import { getSupabase } from "./supabase";
import { fetchParentProfile, NotParentError, type ParentProfile } from "./auth";

/**
 * Вход родителя по номеру телефона с кодом подтверждения.
 *
 * ЧТО БЫЛО. Карта трёх номеров в lib/testAccounts.ts: номер резолвился в
 * логин реального родителя, пароль у всех был один (`parent2026`) и лежал
 * открытым текстом, а код из SMS не проверялся — подходили любые четыре
 * цифры. То есть знание девяти цифр давало вход в чужой кабинет.
 *
 * КАК СТАЛО. Тот же механизм, что на вебе после ec41048: телефон ищется в
 * `parents`, на него выдаётся одноразовый код (срок жизни, лимит попыток,
 * одноразовость, не чаще раза в минуту), и только после его проверки
 * выдаётся сессия.
 *
 * Почему через HTTP, а не напрямую в Supabase: выдача и сверка кода требуют
 * служебного ключа, которому в приложении не место. Оба маршрута живут в
 * apps/web (`/api/parent/request-code`, `/api/parent/verify-code`) и зовут
 * ту же самую библиотеку, что и веб-форма, — логика не раздваивается.
 *
 * Сессию приложение получает само: сервер отдаёт одноразовый `tokenHash`, а
 * `verifyOtp` на устройстве превращает его в сессию под тем же клиентом,
 * которым потом ходят все экраны. Токены сразу оказываются в защищённом
 * хранилище, refresh остаётся за SDK.
 *
 * SMS пока не отправляются — провайдера нет. Код виден админу в карточке
 * родителя, он его диктует. Подключение провайдера меняет одну функцию на
 * стороне веба (`sendSms`), приложение при этом не трогается вовсе.
 */

type ExpoExtra = { webApiBaseUrl?: string };

function baseUrl(): string {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  if (!extra?.webApiBaseUrl) throw new Error("config_error");
  return extra.webApiBaseUrl;
}

/** Причины, которые экран умеет объяснить человеку. */
export type PhoneLoginError =
  | "not_found"      // номера нет в базе — родителей заводит админ
  | "too_soon"       // код уже отправляли меньше минуты назад
  | "wrong_code"     // не подошёл
  | "expired"        // истёк
  | "too_many"       // исчерпаны попытки
  | "no_account"     // родитель есть, учётной записи нет — нужен админ
  | "config_error"   // сборка без webApiBaseUrl
  | "network_error";

export class PhoneLoginFailure extends Error {
  constructor(public reason: PhoneLoginError) {
    super(reason);
  }
}

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error)?.message === "config_error") throw new PhoneLoginFailure("config_error");
    console.error(`[parentPhoneLogin] ${path} — сеть недоступна:`, (e as Error)?.message);
    throw new PhoneLoginFailure("network_error");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const reason = String(json.error ?? "");
    const known: PhoneLoginError[] = ["not_found", "too_soon", "wrong_code", "expired", "too_many", "no_account"];
    throw new PhoneLoginFailure(
      (known as string[]).includes(reason) ? (reason as PhoneLoginError) : "network_error",
    );
  }
  return json;
}

/** Шаг 1: выслать код на номер. `nationalDigits` — девять цифр без кода страны. */
export async function requestPhoneCode(nationalDigits: string): Promise<{ delivered: boolean }> {
  const json = await post("/api/parent/request-code", { phone: nationalDigits });
  return { delivered: json.delivered === true };
}

/** Шаг 2: проверить код и войти. Возвращает профиль родителя. */
export async function verifyPhoneCode(
  nationalDigits: string,
  code: string,
): Promise<ParentProfile> {
  const json = await post("/api/parent/verify-code", { phone: nationalDigits, code });
  const tokenHash = String(json.tokenHash ?? "");
  if (!tokenHash) throw new PhoneLoginFailure("network_error");

  const db = getSupabase();
  const { error } = await db.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) {
    console.error("[parentPhoneLogin] verifyOtp не дал сессию:", error.message);
    throw new PhoneLoginFailure("network_error");
  }

  const profile = await fetchParentProfile();
  if (!profile) {
    await db.auth.signOut();
    throw new NotParentError("no_profile");
  }
  return profile;
}
