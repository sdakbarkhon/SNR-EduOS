import "server-only";
import { after } from "next/server";
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
 *
 * ПРАВИЛО ОТКРЫТОЙ КОПИИ (22.08.2026). Колонка `code_plain` существует
 * потому, что провайдера нет и админ диктует код голосом: прочитать его
 * больше неоткуда. Но раньше открытая копия ПЕРЕЖИВАЛА сам код — код
 * протух или был использован, а его четыре цифры лежали в базе дальше, без
 * срока. Теперь правило простое и держится в одном месте: ОТКРЫТАЯ КОПИЯ
 * УМИРАЕТ ВМЕСТЕ С КОДОМ. Гашение кода — это ровно пять мест в этом файле, и
 * в каждом из них рядом с `used_at` теперь стоит `code_plain: null`:
 *   1) выдан новый код на тот же номер — прошлый гаснет;
 *   2) при проверке оказался просроченным;
 *   3) при проверке кончились попытки;
 *   4) успешный вход;
 *   5) карточка админа наткнулась на истёкший — единственный тихий случай,
 *      когда о коде больше никто бы не вспомнил.
 * Живой неиспользованный код открытым лежит по-прежнему: без этого админу
 * нечего диктовать. Срок жизни у него пять минут.
 *
 * КОМУ ВИДНО. Таблица закрыта от браузера (правила доступа включены, политик
 * ноль), читает её только служебный ключ через `pendingCodeFor`, а тот
 * зовётся из одного места — действия админа, где проверяется и роль, и
 * совпадение школы (app/admin/parents/actions.ts). Чужой код админ не увидит.
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

// ─────────────────────────────────────────────────────────────────────
// ДОСТАВКА SMS — Eskiz.uz. 11.08.2026.
//
// ЕДИНСТВЕННАЯ точка выхода наружу — sendSms() ниже. Всё, что выше и ниже
// неё (срок жизни кода, лимит попыток, одноразовость, защита от частых
// запросов), провайдера не знает и при смене провайдера не меняется.
//
// ТЕСТОВЫЙ СТАТУС АККАУНТА. Пока аккаунт у Eskiz «Тестовый», он принимает
// ТОЛЬКО три фразы, буква в букву, — любой другой текст отвергается. Поэтому
// текст выбирается переключателем ESKIZ_TEST_MODE, а не правкой кода:
//
//   ESKIZ_TEST_MODE=true  (или переменная не задана) → уходит «Это тест от Eskiz»
//   ESKIZ_TEST_MODE=false                            → уходит настоящий текст с кодом
//
// По умолчанию — тестовый режим. Это осознанно: незаданная переменная не
// должна приводить к отправке текста, который провайдер отвергнет. В день
// перевода аккаунта в «Активный» заказчик ставит false в настройках Vercel —
// и ничего больше.
//
// ЗАПИСЬ КОДА В ЛОГ И В code_plain ОСТАВЛЕНА НАМЕРЕННО: пока статус тестовый,
// родителю приходит не код, а разрешённая фраза, и продиктовать код из
// карточки админа — единственный рабочий путь. Снимается отдельной задачей
// после перевода в «Активный».
//
// 22.08.2026 — с оговоркой: открытым лежит только ЖИВОЙ код, см. «правило
// открытой копии» в шапке файла. Запись в лог осталась как была.

const ESKIZ_BASE = "https://notify.eskiz.uz/api";
/** Разрешённые в тестовом статусе фразы. Русская — наша по умолчанию. */
const ESKIZ_TEST_TEXT = "Это тест от Eskiz";
/** Латиница и коротко: одна SMS — 160 символов, кириллица резалась бы на 70. */
const buildCodeText = (code: string) => `SNR EduOS. Kirish kodi: ${code}. Hech kimga aytmang.`;

/** Токен живёт 30 дней. Держим в памяти процесса и обновляем заранее, чтобы
 *  не ходить за ним на каждую отправку. */
let tokenCache: { token: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;   // 25 дней из 30 — с запасом

export type SmsFailure =
  | "not_configured"   // нет учётных данных в окружении
  | "auth_failed"      // почта/пароль не подошли
  | "no_balance"       // на счету нет денег
  | "text_rejected"    // текст не из разрешённых (тестовый статус)
  | "provider_error"   // провайдер ответил ошибкой
  | "unreachable";     // сеть/таймаут

function eskizCreds(): { email: string; password: string; from: string } | null {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  if (!email || !password) return null;
  return { email, password, from: process.env.ESKIZ_FROM || "4546" };
}

/** true, если тестовый режим (по умолчанию — да, см. шапку). */
export function eskizTestMode(): boolean {
  return (process.env.ESKIZ_TEST_MODE ?? "true").toLowerCase() !== "false";
}

async function eskizLogin(force = false): Promise<string | null> {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const creds = eskizCreds();
  if (!creds) return null;

  const res = await fetch(`${ESKIZ_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => null)) as { data?: { token?: string }; message?: string } | null;
  if (!res.ok || !body?.data?.token) {
    // Учётные данные в лог НЕ попадают — только код ответа и текст ошибки.
    console.error(`[sms:eskiz] вход не удался: HTTP ${res.status} ${body?.message ?? ""}`);
    tokenCache = null;
    return null;
  }
  tokenCache = { token: body.data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return tokenCache.token;
}

/** Разбор отказа провайдера в один из известных случаев — чтобы в логе было
 *  видно, ЧТО именно случилось, а не «не отправилось». */
function classify(status: number, message: string): SmsFailure {
  const m = message.toLowerCase();
  if (status === 401 || status === 403) return "auth_failed";
  if (m.includes("balance") || m.includes("баланс") || m.includes("insufficient")) return "no_balance";
  if (m.includes("не найден") || m.includes("not found") || m.includes("шаблон")
      || m.includes("template") || m.includes("text") || status === 400) return "text_rejected";
  return "provider_error";
}

/**
 * ЕДИНСТВЕННОЕ место, где SMS уходит наружу.
 *
 * @param phone номер в нашем каноническом виде `+998XXXXXXXXX` (именно так он
 *   лежит в `parents.phone` — проверено запросом, там 13 символов с плюсом).
 *   Eskiz ждёт двенадцать цифр без плюса, поэтому здесь и только здесь номер
 *   приводится к их формату.
 * @param text настоящий текст с кодом. В тестовом режиме НЕ отправляется:
 *   вместо него уходит разрешённая фраза, а этот текст остаётся в логе.
 */
export async function sendSms(phone: string, text: string): Promise<{ delivered: boolean; failure?: SmsFailure }> {
  const digits = phone.replace(/\D/g, "");
  const testMode = eskizTestMode();
  const message = testMode ? ESKIZ_TEST_TEXT : text;

  // Страховка тестового статуса: код по-прежнему виден в логе сервера и в
  // code_plain, чтобы админ мог его продиктовать.
  console.log(`[sms] → ${phone} (${testMode ? "тестовый режим" : "боевой"}): ${text}`);

  const creds = eskizCreds();
  if (!creds) {
    console.error("[sms:eskiz] не настроен: нет ESKIZ_EMAIL/ESKIZ_PASSWORD");
    return { delivered: false, failure: "not_configured" };
  }

  try {
    let token = await eskizLogin();
    if (!token) return { delivered: false, failure: "auth_failed" };

    const send = async (t: string) =>
      fetch(`${ESKIZ_BASE}/message/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ mobile_phone: digits, message, from: creds.from }),
        signal: AbortSignal.timeout(20000),
      });

    let res = await send(token);
    // Токен мог протухнуть раньше срока (смена пароля, отзыв) — один раз
    // логинимся заново и повторяем. Бесконечного цикла нет: повтор ровно один.
    if (res.status === 401) {
      token = await eskizLogin(true);
      if (!token) return { delivered: false, failure: "auth_failed" };
      res = await send(token);
    }

    const body = (await res.json().catch(() => null)) as
      | { id?: string | number; status?: string; message?: string }
      | null;

    if (!res.ok) {
      const failure = classify(res.status, String(body?.message ?? ""));
      console.error(`[sms:eskiz] отказ (${failure}): HTTP ${res.status} ${JSON.stringify(body)}`);
      return { delivered: false, failure };
    }

    console.log(`[sms:eskiz] принято: id=${body?.id ?? "—"} status=${body?.status ?? "—"}`);
    return { delivered: true };
  } catch (e) {
    const name = (e as Error)?.name === "TimeoutError" ? "таймаут" : (e as Error)?.message ?? String(e);
    console.error(`[sms:eskiz] сервис недоступен: ${name}`);
    return { delivered: false, failure: "unreachable" };
  }
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
/**
 * Выдаёт код. `deferSms` — не ждать провайдера: ответ уходит, как только код
 * записан, а отправка доигрывается после ответа через after() из next/server.
 *
 * ЗАЧЕМ. Замерено на боевом адресе: один вход к Eskiz занимает 0,8–3,1 с, и
 * это ещё до самой отправки. Всё это время человек смотрел на замерший экран,
 * хотя код уже лежал в базе и продиктовать его админ мог сразу. Ждать
 * провайдера, чтобы показать экран ввода кода, незачем.
 *
 * По умолчанию режим прежний (ждём) — веб-форма родителя показывает
 * «код не отправился» по полю delivered, и менять ей поведение мы не вправе.
 * Мобильное приложение это поле не читает вовсе, поэтому зовёт с deferSms.
 */
export async function issueParentCode(
  rawPhone: string,
  opts?: { deferSms?: boolean },
): Promise<IssueCodeResult> {
  const phone = normalizeUzPhone(rawPhone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const sb = serviceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  // Два независимых чтения — параллельно. Последовательно они стоили лишний
  // круг до Франкфурта (~0,3 с) на ровном месте.
  const [{ data: parent, error: pErr }, { data: last }] = await Promise.all([
    anySb.from("parents").select("id").eq("phone", phone).maybeSingle(),
    anySb.from("parent_phone_codes").select("created_at")
      .eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (pErr) return { ok: false, error: "failed" };

  // 19.08.2026 — КУЛДАУН ПРОВЕРЯЕТСЯ ПЕРЕД СУЩЕСТВОВАНИЕМ НОМЕРА.
  //
  // Было наоборот: сперва «нет такого родителя», потом «слишком часто».
  // Порядок значил, что несуществующий номер не троттлился вовсе, а
  // существующий — троттлился, и по этой разнице перебирался список настоящих
  // номеров. Теперь первым отвечает кулдаун.
  //
  // ЧЕСТНО О ГРАНИЦАХ ЭТОЙ ПРАВКИ. Сама по себе она перебор НЕ закрывает.
  // У несуществующего номера строк в parent_phone_codes нет никогда, значит
  // кулдаун на нём не срабатывает и ответ всё равно приходит not_found, тогда
  // как у свободного настоящего номера — ok. Разница «200 против не-200»
  // остаётся. Закрыть её можно двумя способами, и оба за пределами этого
  // захода: либо отвечать «код отправлен» всегда (тогда человек с опечаткой
  // уйдёт на экран ввода кода и упрётся там в стену), либо помнить обращения
  // по адресу — а для этого нужна таблица-счётчик, то есть миграция.
  //
  // Что правка всё-таки даёт: время ответа у обоих случаев одинаково (оба
  // чтения идут одним Promise.all выше), а порядок проверок перестал быть тем
  // местом, которое придётся переставлять, когда счётчик по адресу появится.
  if (last && Date.now() - Date.parse(last.created_at as string) < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "too_soon" };
  }

  if (!parent) return { ok: false, error: "not_found" };

  // Прошлые коды этого номера гасим: одновременно живым может быть один.
  // Вместе с кодом гасится и его открытая копия — см. правило в шапке файла.
  await anySb.from("parent_phone_codes")
    .update({ used_at: new Date().toISOString(), code_plain: null })
    .eq("phone", phone).is("used_at", null);

  const code = String(randomInt(0, 10000)).padStart(4, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insErr } = await anySb.from("parent_phone_codes").insert({
    phone, code_hash: hashCode(code, phone), code_plain: code, expires_at: expiresAt,
  });
  if (insErr) return { ok: false, error: "failed" };

  const text = buildCodeText(code);
  if (opts?.deferSms) {
    // Ответ уходит сейчас, отправка доигрывается после него. after() держит
    // функцию живой до конца отправки — «выстрелил и забыл» на serverless
    // оборвал бы запрос вместе с ответом.
    after(async () => {
      try {
        await sendSms(phone, text);
      } catch (e) {
        console.error("[sms] отложенная отправка не удалась:", e);
      }
    });
    // Ждать было нечего, поэтому и утверждать «доставлено» нельзя.
    return { ok: true, expiresAt, delivered: false };
  }

  const { delivered } = await sendSms(phone, text);
  return { ok: true, expiresAt, delivered };
}

export type VerifyCodeResult =
  | { ok: true; parentId: string; userId: string | null }
  | {
      ok: false;
      error: "invalid_phone" | "no_code" | "expired" | "too_many" | "wrong_code" | "failed";
      /** Сколько попыток осталось у действующего кода. Есть только у
       *  wrong_code — в остальных случаях код уже погашен. Нужно, чтобы
       *  человек видел, сколько ему осталось, а не упирался в глухое
       *  «слишком много попыток» после пятой. */
      attemptsLeft?: number;
    };

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
    await anySb.from("parent_phone_codes")
      .update({ used_at: new Date().toISOString(), code_plain: null }).eq("id", row.id);
    return { ok: false, error: "expired" };
  }
  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    await anySb.from("parent_phone_codes")
      .update({ used_at: new Date().toISOString(), code_plain: null }).eq("id", row.id);
    return { ok: false, error: "too_many" };
  }

  if (row.code_hash !== hashCode(code, phone)) {
    const used = (row.attempts as number) + 1;
    await anySb.from("parent_phone_codes")
      .update({ attempts: used }).eq("id", row.id);
    return { ok: false, error: "wrong_code", attemptsLeft: Math.max(0, MAX_ATTEMPTS - used) };
  }

  // Гасим до выдачи сессии: код одноразовый даже если вход дальше не удастся.
  await anySb.from("parent_phone_codes")
    .update({ used_at: new Date().toISOString(), code_plain: null }).eq("id", row.id);

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
    .from("parent_phone_codes").select("id, code_plain, expires_at")
    .eq("phone", canonical).is("used_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.code_plain) return null;
  if (Date.parse(data.expires_at as string) < Date.now()) {
    // Пятый случай смерти кода, и единственный тихий: код истёк сам, его
    // никто не проверял и нового не просил. Раньше такая строка так и лежала
    // с открытой копией, потому что момента, в который её погасить, не
    // наступало. Теперь этот момент — вот он: мы как раз о ней узнали.
    await (sb as any).from("parent_phone_codes")
      .update({ used_at: new Date().toISOString(), code_plain: null }).eq("id", data.id);
    return null;
  }
  return { code: data.code_plain as string, expiresAt: data.expires_at as string };
}
