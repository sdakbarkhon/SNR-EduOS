// Утренний крон: раз в сутки в 04:00 UTC (= 09:00 Ташкент, см. vercel.json),
// для каждого из 3 классов:
//   - закрывает 1-й урок дня (если ещё не 'completed');
//   - стартует 2-й урок дня (если ещё 'scheduled').
//
// Логика идентична фолбэку из RSC (apps/web/lib/ensureMorningCycleRan.ts) —
// это гарантированный "тик" в 09:00 Ташкент, ensureMorningCycleRan — сеть
// безопасности на случай сбоя крона или тестовых запусков вне расписания.
//
// Идемпотентно по конструкции: completeLessons() внутри гардит neq='completed',
// UPDATE второго урока гардит status='scheduled'. Повторный вызов ничего
// не портит.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMorningLessonCycle } from "@/lib/runMorningLessonCycle";

export async function POST(req: NextRequest) {
  const cronSecret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  try {
    const res = await runMorningLessonCycle(admin);
    console.log(
      `[morning-lesson-cycle] processed_groups=${res.processed_groups} actions=${JSON.stringify(res.actions)}`,
    );
    return NextResponse.json(res);
  } catch (e) {
    console.error("[morning-lesson-cycle] failed:", (e as Error)?.message ?? e);
    return NextResponse.json({ error: (e as Error)?.message ?? "morning cycle failed" }, { status: 500 });
  }
}
