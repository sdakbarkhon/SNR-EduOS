// DISABLED 05.08.2026 — auto-start/auto-close of lessons removed by client
// request. Manual lesson start only, via "Start lesson" button. Cron entry
// removed from vercel.json; this route is kept (not deleted) as a harmless
// no-op in case anything still hits the path directly.
//
// Original implementation called runMorningLessonCycle() — see
// apps/web/lib/runMorningLessonCycle.ts, also disabled, logic preserved
// there as a comment for reference.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, skipped: "morning-lesson-cycle disabled permanently 05.08.2026" });
}
