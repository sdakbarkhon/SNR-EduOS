// Ночной крон (решение 21.07) — с отключённым авто-стартом/авто-финишем
// по времени (см. миграция 143) уроки прошедших дней, которые учитель не
// начал/не закончил вручную, никогда бы сами не перешли в 'completed'.
// Раз в сутки в 19:00 UTC (= 00:00 по Ташкенту, см. vercel.json) закрывает
// их одним UPDATE — по времени (ends_at), НЕ по статусу, только уроки СТРОГО
// прошедших дней (сегодняшние и будущие не трогает).
//
// Гейт: ends_at < начало сегодняшнего дня по Ташкенту (UTC+5) И status !=
// 'completed'. Идемпотентно по конструкции — уже completed исключены самим
// гейтом, повторный запуск находит 0 строк.
//
// Намеренно НЕ трогает lesson_stages/attendance (в отличие от
// fn_auto_end_lessons()) — задача просила закрыть только сам статус урока,
// не воспроизводить полный набор побочных эффектов автозавершения.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TZ_MS = 5 * 60 * 60 * 1000; // Ташкент, UTC+5 — фиксированное смещение, не системный часовой пояс

function startOfTodayTashkentUtcIso(): string {
  const nowUtc = new Date();
  const tashkentNow = new Date(nowUtc.getTime() + TZ_MS);
  const tashkentMidnightUtcMs =
    Date.UTC(tashkentNow.getUTCFullYear(), tashkentNow.getUTCMonth(), tashkentNow.getUTCDate()) - TZ_MS;
  return new Date(tashkentMidnightUtcMs).toISOString();
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = startOfTodayTashkentUtcIso();

  const { data, error } = await db
    .from("lessons")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .lt("ends_at", cutoff)
    .neq("status", "completed")
    .select("id");

  if (error) {
    console.error("[close-past-lessons] update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const closed = data?.length ?? 0;
  console.log(`[close-past-lessons] cutoff=${cutoff} closed=${closed}`);
  return NextResponse.json({ cutoff, closed });
}
