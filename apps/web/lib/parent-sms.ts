import "server-only";
import { createHash, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeUzPhone } from "@snr/core";

/**
 * Z.2.8 — коды подтверждения входа родителя и доставка SMS.
 *
 * ПОДКЛЮЧЕНИЕ ПРОВАЙДЕРА — ЗАМЕНА ОДНОЙ ФУНКЦИИ. Вся доставка изолирована в
 * `sendSms` ниже. Когда появится Eskiz.uz, меняется её тело и удаляются два
 * временных следа: запись кода в лог и колонка `code_plain`. Ни один другой
 * файл трогать не придётся.
 *
 * КОД НАСТОЯЩИЙ С ПЕРВОГО ДНЯ. Выбор между «принимать любой код» и
 * «генерировать реальный, доставку заглушить» сделан в пользу второго:
 * при «любом» путь проверки никогда не исполняется, и в день подключения
 * провайдера он оказался бы непротестированным — а до тех пор это открытая
 * дверь, про которую все забудут. Здесь работают срок жизни, лимит попыток
 * и одноразовость.
 */

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Не чаще одного кода в минуту на номер — чтобы кнопка «выслать ещё раз» не
 *  превращалась в генератор мусора и, в будущем, в счёт от провайдера. */
const RESEND_COOLDOWN_MS = 60 * 1000;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Хеш кода. Соль не нужна: код одноразовый, живёт пять минут и привязан к
 *  номеру, который в хеш и подмешивается. */
function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${code}:${phone}`).digest("hex");
}

/**
 * ЕДИНСТВЕННОЕ место, где SMS уходит наружу. Сейчас — заглушка.
 *
 * Провайдера нет, поэтому код попадает в лог сервера и в `code_plain`, чтобы
 * админ мог продиктовать его родителю из карточки. Это осознанный временный
 * компромисс, снимаемый вместе с заглушкой.
 *
 * Подключение Eskiz.uz: заменить тело на HTTP-запрос к их API и вернуть
 * `{ delivered: true }`. Вызывающий код от этого не меняется.
 */
export async function sendSms(phone: string, text: string): Promise<{ delivered: boolean }> {
  console.log(`[sms:stub] → ${phone}: ${text}`);
  return { delivered: false };
}

export type IssueCodeResult =
  | { ok: true; expiresAt: string; delivered: boolean }
  | { ok: false; error: "invalid_phone" | "not_found" | "too_soon" | "failed" };

/**
 * Выдаёт код на номер зарегистрированного родителя.
 *
 * Несуществующий номер отвечает `not_found` намеренно, а не «успехом»: это
 * админская система с заведёнными вручную родителями, а не публичная
 * регистрация, и «код отправлен» на чужой номер запутал бы человека, который
 * просто ошибся цифрой. Перебором номеров это не злоупотребишь — код всё
 * равно приходит только на настоящий телефон.
 */
export async function issueParentCode(rawPhone: string): Promise<IssueCodeResult> {
  const phone = normalizeUzPhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const sb = serviceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: parent, error: pErr } = await anySb
    .from("parents").select("id").eq("phone", phone).maybeSingle();
  if (pErr) return { ok: false, error: "failed" };
  if (!parent) return { ok: false, error: "not_found" };

  const { data: last } = await anySb
    .from("parent_phone_codes").select("created_at")
    .eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - Date.parse(last.created_at as string) < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "too_soon" };
  }

  // Прошлые коды этого номера гасим: одновременно живым может быть один.
  await anySb.from("parent_phone_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("phone", phone).is("used_at", null);

  const code = String(randomInt(0, 10000)).padStart(4, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insErr } = await anySb.from("parent_phone_codes").insert({
    phone, code_hash: hashCode(code, phone), code_plain: code, expires_at: expiresAt,
  });
  if (insErr) return { ok: false, error: "failed" };

  const { delivered } = await sendSms(phone, `SNR EduOS: код входа ${code}`);
  return { ok: true, expiresAt, delivered };
}

export type VerifyCodeResult =
  | { ok: true; parentId: string; userId: string | null }
  | { ok: false; error: "invalid_phone" | "no_code" | "expired" | "too_many" | "wrong_code" | "failed" };

/** Проверяет код по-настоящему: срок жизни, число попыток, одноразовость. */
export async function verifyParentCode(rawPhone: string, code: string): Promise<VerifyCodeResult> {
  const phone = normalizeUzPhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  if (!/^\d{4}$/.test(code)) return { ok: false, error: "wrong_code" };

  const sb = serviceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: row, error } = await anySb
    .from("parent_phone_codes")
    .select("id, code_hash, expires_at, attempts, used_at")
    .eq("phone", phone).is("used_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false, error: "failed" };
  if (!row) return { ok: false, error: "no_code" };

  if (Date.parse(row.expires_at as string) < Date.now()) {
    await anySb.from("parent_phone_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: "expired" };
  }
  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    await anySb.from("parent_phone_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: "too_many" };
  }

  if (row.code_hash !== hashCode(code, phone)) {
    await anySb.from("parent_phone_codes")
      .update({ attempts: (row.attempts as number) + 1 }).eq("id", row.id);
    return { ok: false, error: "wrong_code" };
  }

  // Гасим до выдачи сессии: код одноразовый даже если вход дальше не удастся.
  await anySb.from("parent_phone_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  const { data: parent } = await anySb
    .from("parents").select("id, user_id").eq("phone", phone).maybeSingle();
  if (!parent) return { ok: false, error: "failed" };
  return { ok: true, parentId: parent.id as string, userId: (parent.user_id as string | null) ?? null };
}

/** Действующий код для карточки админа — временно, пока нет провайдера. */
export async function pendingCodeFor(phone: string): Promise<{ code: string; expiresAt: string } | null> {
  const canonical = normalizeUzPhone(phone);
  if (!canonical) return null;
  const sb = serviceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("parent_phone_codes").select("code_plain, expires_at")
    .eq("phone", canonical).is("used_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.code_plain) return null;
  if (Date.parse(data.expires_at as string) < Date.now()) return null;
  return { code: data.code_plain as string, expiresAt: data.expires_at as string };
}
