import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSbClient } from "@supabase/supabase-js";

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

/** Столько же попыток, сколько у веб-версии: часть аккаунтов пула отдаёт
 *  пароль, которым учётка не открывается, и следующий слот обычно рабочий. */
const ATTEMPTS = 3;

export async function POST() {
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
    const sb = createSbClient(url, anon, { auth: { persistSession: false } });
    const { data: signed, error: signErr } = await sb.auth.signInWithPassword({
      email: row.email,
      password: row.password,
    });

    if (signErr || !signed.session) {
      lastReason = signErr?.message ?? "не удалось войти под выданным аккаунтом";
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
