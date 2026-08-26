import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, retryHeaders } from "@/lib/rate-limit";
import { issueDemoOtpHash } from "@/lib/demo-otp";

// Демо-вход родителя для мобильного приложения.
//
// ТОТ ЖЕ МЕХАНИЗМ, ЧТО НА ВЕБЕ. Слот берётся той же функцией claim_demo_slot
// (миграции 133/135), что и кнопка «Демо» в браузере, и та же аренда потом
// продлевается через /api/demo/heartbeat и освобождается через
// /api/demo/release — приложение уже умеет и то и другое, отправляя
// session_token телом запроса. Второго механизма не появляется: разница с
// вебом ровно одна — куда положить сессию.
//
// ПОЧЕМУ ОТДАЁМ ТОКЕНЫ, А НЕ ПАРОЛЬ. Прежняя мобильная ручка возвращала пароль
// выданного аккаунта открытым текстом; её убрали именно за это. Здесь вход
// выполняется НА СЕРВЕРЕ, а наружу уходит готовая пара токенов — приложение
// кладёт её через setSession. Токен живёт час и привязан к этой аренде, пароль
// же дал бы бессрочный доступ любому, кто прочитал ответ.
//
// 26.08.2026 — ПАРОЛЬ УБРАН И ИЗ САМОГО ВХОДА. Раньше сервер звал
// signInWithPassword паролем-литералом, который claim_demo_slot возвращает не
// проверяя. Теперь служебный клиент выпускает одноразовый token_hash и тут же
// меняет его на сессию (lib/demo-otp.ts) — как это делает веб. Ответ наружу не
// изменился: те же access_token, refresh_token и ключ аренды, поэтому
// приложение править не пришлось и выкладывать обновление не нужно.
//
// ЗАЩИТУ ОДНОЙ СЕССИИ НЕ ЗАДЕВАЕТ. Демо-вход не регистрируется в user_sessions
// (как и на вебе: registerSession зовётся только в finishLogin обычного входа),
// поэтому вход в демо не выкидывает настоящего пользователя с другого
// устройства и наоборот.

export const runtime = "nodejs";

interface ClaimRow {
  username: string | null;
  email: string;
  password: string;
  session_token: string;
  user_id: string;
}

/** Столько же попыток, сколько у веб-версии. С 26.08 защищают уже не от
 *  битого пароля (его больше нет в обмене), а от аккаунта, под которым сессия
 *  не выдаётся в принципе: бан, пометка удаления, пустой адрес, отсутствие
 *  записи в auth.identities. У родителя в демо аккаунт один, поэтому здесь
 *  повтор берёт тот же слот — но он же ловит и разовый сбой службы. */
const ATTEMPTS = 3;

/**
 * ЧАСТОТА: 10 обращений с одного адреса в час (миграция 219).
 *
 * Здесь порог ниже, чем у входа родителя, и это осознанно: каждый вызов
 * ЗАНИМАЕТ демо-слот из общего пула, а слотов конечное число. Один бот без
 * ограничения способен разобрать весь пул и оставить настоящих посетителей
 * без демо. Десять за час — это десять просмотров демо с одного адреса, чего
 * живому человеку с запасом хватает.
 *
 * Закрытого списка кодов здесь нет: приложение показывает любой отказ одним и
 * тем же сообщением (AuthSessionContext.tsx — «error» без разбора), поэтому
 * код можно назвать своими словами.
 */
const ПОРОГ = 10;
const ОКНО_С = 3600;

export async function POST(req: NextRequest) {
  const частота = await rateLimit(clientIp(req.headers), "demo_claim_parent", ПОРОГ, ОКНО_С);
  if (!частота.allowed) {
    return NextResponse.json(
      { error: "too_many_requests" }, { status: 429, headers: retryHeaders(частота) },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  let lastReason = "";

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claimed, error: claimError } = await (admin.rpc as any)("claim_demo_slot", {
      p_role: "parent",
      p_subject_slug: null,
      p_grade_level: null,
    });

    if (claimError) {
      const msg = claimError.message ?? "";
      if (msg.includes("no_available_slot")) {
        return NextResponse.json({ error: "all_busy" }, { status: 503 });
      }
      return NextResponse.json({ error: "demo_unavailable", reason: msg }, { status: 503 });
    }

    const row = (Array.isArray(claimed) ? claimed[0] : claimed) as ClaimRow | undefined;
    if (!row?.email) {
      lastReason = "пустой слот";
      continue;
    }

    // Вход выполняется здесь, на сервере: наружу уйдут токены, не пароль.
    const otp = await issueDemoOtpHash(admin, row.email);
    if (!otp.ok) {
      lastReason = otp.reason;
      console.error("[demo/claim-parent] ссылка не выпущена:", otp.reason);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.rpc as any)("release_demo_slot", { p_session_token: row.session_token }).catch(() => null);
      continue;
    }

    const sb = createSbClient(url, anon, { auth: { persistSession: false } });
    const { data: signed, error: signErr } = await sb.auth.verifyOtp({
      type: "email",
      token_hash: otp.tokenHash,
    });

    if (signErr || !signed.session) {
      lastReason = signErr?.message ?? "одноразовая ссылка не принята";
      console.error("[demo/claim-parent] ссылка не принята:", lastReason);
      // Слот негодный — освобождаем и берём следующий.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.rpc as any)("release_demo_slot", { p_session_token: row.session_token }).catch(() => null);
      continue;
    }

    return NextResponse.json({
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
      // Ключ аренды: приложение шлёт его в heartbeat и release.
      session_token: row.session_token,
    });
  }

  console.error("[demo/claim-parent] не удалось выдать слот:", lastReason);
  return NextResponse.json({ error: "demo_unavailable", reason: lastReason }, { status: 503 });
}
