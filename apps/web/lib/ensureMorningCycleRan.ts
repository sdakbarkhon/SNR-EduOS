// DISABLED 05.08.2026 — auto-start/auto-close of lessons removed by client
// request. Manual lesson start only, via "Start lesson" button.
//
// Was: RSC fallback for the "утренний цикл уроков", called on load from
// apps/web/app/(app)/lessons/page.tsx, apps/web/app/(app)/lessons/[id]/page.tsx,
// apps/web/app/teacher/lessons/page.tsx, apps/web/app/teacher/lessons/[id]/page.tsx
// — all four call sites are unchanged (`try { await ensureMorningCycleRan(); }
// catch { /* noop */ }`) and now simply await a no-op. Signature kept
// (zero args, Promise<void>) so those call sites keep compiling unchanged.
//
// See apps/web/lib/runMorningLessonCycle.ts (also disabled, original logic
// preserved there as a comment) and apps/web/app/api/cron/morning-lesson-cycle/route.ts
// (cron entry removed from vercel.json, route left as a no-op).

export async function ensureMorningCycleRan(): Promise<void> {
  return;
}
