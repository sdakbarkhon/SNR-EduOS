"use server";

import { cookies, headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizeUzPhone } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { registerSession } from "@/lib/register-session";
import { issueParentCode, verifyParentCode } from "@/lib/parent-sms";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Z.2.8 — вход родителя по телефону с настоящим кодом подтверждения.
 *
 * ЧТО БЫЛО. Захардкоженная карта трёх номеров в packages/core, общий пароль
 * `parent2026` открытым текстом и код, который не проверялся вовсе: любые
 * четыре цифры проходили. Всё это удалено.
 *
 * КАК СТАЛО. Телефон ищется в `parents` (phone NOT NULL + UNIQUE, миграция
 * 180), на него выдаётся одноразовый код со сроком жизни и лимитом попыток,
 * и только после его проверки выдаётся сессия.
 *
 * ПОЧЕМУ СЕССИЯ БЕЗ ПАРОЛЯ. Родитель пароль не вводит — он подтверждает
 * владение номером. Пароль у учётной записи есть (его задаёт админ и он
 * нужен мобильному приложению), но серверу он неизвестен: в базе хеш.
 * Поэтому сессия выдаётся штатным приёмом Supabase — service-role
 * `generateLink` даёт одноразовый token_hash, который тут же обменивается на
 * сессию через `verifyOtp`. Наружу этот токен не уходит.
 *
 * СУЩЕСТВУЮЩИЕ АДРЕСА НЕ МИГРИРУЮТСЯ: адрес берётся у самого пользователя по
 * `parents.user_id`, а не собирается из номера. Демо-родитель как входил
 * (parent_ismailov@…), так и входит, ему лишь проставлен телефон.
 */

export type CodeRequestResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: "invalid_phone" | "not_found" | "too_soon" | "failed" };

/**
 * ЧАСТОТА СЧИТАЕТСЯ И ЗДЕСЬ, В ОДИН СЧЁТЧИК С /api/parent/request-code.
 *
 * ЗАЧЕМ. Маршрут закрыли счётчиком по адресу (миграция 219), а эта дверь
 * оставалась открытой: веб-форма ходит не через маршрут, а сюда, и
 * идентификатор серверного действия виден в HTML страницы — то есть позвать
 * его снаружи можно, а счётчик при этом не срабатывал.
 *
 * ПОЧЕМУ СЧЁТЧИК ОБЩИЙ, А НЕ СВОЙ. Защищаем мы не дверь, а то, что за ней:
 * отправку SMS за наши деньги и список настоящих номеров. Заведи мы здесь
 * второе имя действия — и потолок с одного адреса стал бы 120 вместо 60,
 * причём ровно тем способом, который мы только что закрывали. Один человек
 * пользуется одной дверью, поэтому общий счётчик его не ужимает.
 *
 * ПОРОГ И КОД ОТКАЗА ТЕ ЖЕ. 60 в час; отказ уходит как too_soon — он уже есть
 * в типе результата и уже показывается формой как «код запрашивали слишком
 * часто», новых строк заводить не нужно.
 */
const ПОРОГ_КОДА = 60;
const ОКНО_С = 3600;

export async function requestParentCode(nationalDigits: string): Promise<CodeRequestResult> {
  const адрес = clientIp(await headers());

  const частота = await rateLimit(адрес, "parent_request_code", ПОРОГ_КОДА, ОКНО_С);
  if (!частота.allowed) return { ok: false, error: "too_soon" };

  const result = await issueParentCode(nationalDigits);

  if (!result.ok) {
    // ПОВТОРНЫЙ СТУК В НЕСУЩЕСТВУЮЩИЙ НОМЕР ОТВЕЧАЕТ КАК В НАСТОЯЩИЙ —
    // то же самое, что на маршруте. Без этого обе двери вели бы себя
    // по-разному, и перебирать номера начали бы через ту, где проще:
    // у настоящего номера второй запрос за минуту упирается в кулдаун и даёт
    // too_soon, а у несуществующего кулдауну не за что зацепиться — строки в
    // parent_phone_codes не появляется.
    if (result.error === "not_found") {
      const канон = normalizeUzPhone(nationalDigits);
      if (канон) {
        const повтор = await rateLimit(`phone:${канон}`, "parent_unknown_probe", 1, 60);
        if (!повтор.allowed) return { ok: false, error: "too_soon" };
      }
    }
    return result;
  }
  return { ok: true, delivered: result.delivered };
}

export type PhoneLoginResult =
  | { ok: true; dest: string }
  | { ok: false; error: "invalid_phone" | "invalid_code" | "not_found" | "failed" };

/** Телефон демо-родителя (Исмаилов Бахтиёр, ребёнок — Шерзод, 10-А). */
const DEMO_PARENT_PHONE = "+998912345678";

/**
 * Демо-вход родителя на вебе — кнопка «Посмотреть демо» на /parent.
 *
 * ПОЧЕМУ ОТДЕЛЬНОЕ ДЕЙСТВИЕ. Кнопка звала обычный loginParentByPhone с
 * кодом-заглушкой "0000": до ec41048 код не проверялся вовсе, и это
 * работало. После ec41048 код проверяется по-настоящему, "0000" стал
 * отвечать `no_code`, и демо-вход перестал пускать внутрь — заказчик
 * упирался в это на eduos.snruz.uz/parent.
 *
 * Чинить подделкой кода нельзя: любой обход проверки на общем пути — это
 * дыра, ведущая в настоящий кабинет. Поэтому демо получает свой вход,
 * жёстко привязанный к ОДНОМУ номеру, и общий путь остаётся строгим.
 *
 * Сессия выдаётся тем же приёмом, что и после кода: одноразовый token_hash
 * от служебного клиента, обмен через verifyOtp. Пароль не участвует.
 */
export async function demoParentLogin(): Promise<PhoneLoginResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "failed" };
  const admin = createServiceClient(url, key, { auth: { persistSession: false } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (admin as any)
    .from("parents").select("user_id").eq("phone", DEMO_PARENT_PHONE).maybeSingle();
  const userId = (parent?.user_id as string | null) ?? null;
  if (!userId) return { ok: false, error: "not_found" };

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (!email) return { ok: false, error: "failed" };

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink", email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return { ok: false, error: "failed" };

  const supabase = await createClient();
  const { data: session, error: otpErr } = await supabase.auth.verifyOtp({
    type: "email", token_hash: tokenHash,
  });
  if (otpErr || !session.user || !session.session) return { ok: false, error: "failed" };

  await registerSession({
    userId: session.user.id,
    accessToken: session.session.access_token,
  });
  (await cookies()).delete(DEMO_SESSION_COOKIE);

  return { ok: true, dest: "/parent/home" };
}

export async function loginParentByPhone(
  nationalDigits: string,
  code: string,
): Promise<PhoneLoginResult> {
  const verified = await verifyParentCode(nationalDigits, code);
  if (!verified.ok) {
    if (verified.error === "invalid_phone") return { ok: false, error: "invalid_phone" };
    if (verified.error === "failed") return { ok: false, error: "failed" };
    // no_code / expired / too_many / wrong_code — для человека это всё «код
    // не подошёл, запросите новый»; подробности в тексте экрана.
    return { ok: false, error: "invalid_code" };
  }
  if (!verified.userId) return { ok: false, error: "failed" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "failed" };
  const admin = createServiceClient(url, key, { auth: { persistSession: false } });

  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(verified.userId);
  const email = authUser?.user?.email;
  if (userErr || !email) return { ok: false, error: "failed" };

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink", email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return { ok: false, error: "failed" };

  const supabase = await createClient();
  const { data: session, error: otpErr } = await supabase.auth.verifyOtp({
    type: "email", token_hash: tokenHash,
  });
  if (otpErr || !session.user || !session.session) return { ok: false, error: "failed" };

  await registerSession({
    userId: session.user.id,
    accessToken: session.session.access_token,
  });

  (await cookies()).delete(DEMO_SESSION_COOKIE);

  return { ok: true, dest: "/parent/home" };
}
