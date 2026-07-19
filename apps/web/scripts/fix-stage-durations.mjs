// ЧАСТЬ 1 — for every lesson whose lesson_stages.duration_min sum (middle
// stages only — start/summary never carry a duration) doesn't match the
// lesson's actual duration (ends_at - starts_at), proportionally rescale the
// middle-stage durations so they sum EXACTLY to the lesson's duration,
// preserving relative proportions (same algorithm as the live in-app
// AiGenerateStagesModal.tsx rescale: round each proportionally, then absorb
// the rounding remainder into the last stage).
//
// Only touches middle stages that already HAVE a duration_min set — stages
// with duration_min=NULL (never AI-estimated) are left untouched, matching
// how the UI already treats null as "no time shown" (?? 0).
//
// Idempotent: if a lesson's sum already equals its actual duration, it's
// skipped entirely — re-running produces zero writes.
//
// Usage: node scripts/fix-stage-durations.mjs [--dry-run]

import fs from "fs";

const envContent = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function envVar(name) {
  const m = envContent.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${name} in .env.local`);
  return m[1].trim();
}
const SUPABASE_URL = envVar("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = envVar("SUPABASE_SERVICE_ROLE_KEY");

const DRY_RUN = process.argv.includes("--dry-run");

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Same rescale algorithm as apps/web/app/teacher/lessons/[id]/AiGenerateStagesModal.tsx
function rescale(stages, target) {
  const total = stages.reduce((s, x) => s + x.duration_min, 0);
  if (total === 0 || total === target) return stages.map((s) => s.duration_min);
  const scaled = stages.map((s) => Math.max(1, Math.round((s.duration_min * target) / total)));
  const newTotal = scaled.reduce((a, b) => a + b, 0);
  if (newTotal !== target) {
    const lastIdx = scaled.length - 1;
    scaled[lastIdx] = Math.max(1, scaled[lastIdx] + (target - newTotal));
  }
  return scaled;
}

async function main() {
  console.log(`Режим: ${DRY_RUN ? "DRY-RUN (без записи)" : "БОЕВОЙ (пишем в БД)"}`);

  const stages = await sb(
    "lesson_stages?select=id,lesson_id,stage_role,position,duration_min&stage_role=eq.middle&order=lesson_id,position",
  );
  console.log(`Всего middle-этапов в БД: ${stages.length}`);

  const byLesson = new Map();
  for (const s of stages) {
    if (!byLesson.has(s.lesson_id)) byLesson.set(s.lesson_id, []);
    byLesson.get(s.lesson_id).push(s);
  }

  // Only lessons where ALL middle stages have duration_min set (matches the
  // live investigation: 175 lessons fully set, 1 partial-null lesson left
  // untouched entirely — its non-null subset isn't a coherent "full estimate"
  // to rescale against).
  const candidateLessonIds = [...byLesson.entries()]
    .filter(([, stgs]) => stgs.every((s) => s.duration_min != null))
    .map(([lid]) => lid);
  console.log(`Уроков с полностью заданными duration_min у всех middle-этапов: ${candidateLessonIds.length}`);

  const lessons = [];
  for (let i = 0; i < candidateLessonIds.length; i += 200) {
    const batch = candidateLessonIds.slice(i, i + 200);
    const rows = await sb(`lessons?select=id,starts_at,ends_at&id=in.(${batch.join(",")})`);
    lessons.push(...rows);
  }
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const plan = [];
  for (const lid of candidateLessonIds) {
    const lesson = lessonById.get(lid);
    if (!lesson) continue;
    const actualMin = Math.round((new Date(lesson.ends_at) - new Date(lesson.starts_at)) / 60000);
    const stgs = byLesson.get(lid).slice().sort((a, b) => a.position - b.position);
    const currentSum = stgs.reduce((s, x) => s + x.duration_min, 0);
    if (currentSum === actualMin) continue; // already correct — idempotent skip

    const newDurations = rescale(stgs, actualMin);
    const newSum = newDurations.reduce((a, b) => a + b, 0);
    plan.push({ lessonId: lid, actualMin, currentSum, newSum, stages: stgs.map((s, i) => ({ id: s.id, old: s.duration_min, new: newDurations[i] })) });
  }

  console.log(`\nУроков к пересчёту: ${plan.length}`);
  const badSum = plan.filter((p) => p.newSum !== p.actualMin);
  if (badSum.length > 0) {
    console.error(`ВНИМАНИЕ: ${badSum.length} уроков не сходятся даже после rescale (слишком много этапов на слишком короткий урок):`);
    console.error(JSON.stringify(badSum, null, 2));
  }

  console.log("\nПримеры первых 5 пересчётов:");
  console.log(JSON.stringify(plan.slice(0, 5), null, 2));

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Ничего не записано.");
    return;
  }

  let stagesWritten = 0;
  for (const p of plan) {
    for (const s of p.stages) {
      if (s.old === s.new) continue;
      await sb(`lesson_stages?id=eq.${s.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ duration_min: s.new }),
      });
      stagesWritten++;
    }
  }
  console.log(`\nОбновлено этапов: ${stagesWritten} (в ${plan.length} уроках)`);

  // Verify
  const verifyIds = plan.map((p) => p.lessonId);
  let mismatchCount = 0;
  for (let i = 0; i < verifyIds.length; i += 200) {
    const batch = verifyIds.slice(i, i + 200);
    const after = await sb(
      `lesson_stages?select=lesson_id,duration_min&stage_role=eq.middle&lesson_id=in.(${batch.join(",")})`,
    );
    const sumByLesson = new Map();
    for (const s of after) sumByLesson.set(s.lesson_id, (sumByLesson.get(s.lesson_id) ?? 0) + s.duration_min);
    for (const p of plan.filter((x) => batch.includes(x.lessonId))) {
      if (sumByLesson.get(p.lessonId) !== p.actualMin) {
        mismatchCount++;
        console.error(`ВНИМАНИЕ: урок ${p.lessonId} — сумма после записи ${sumByLesson.get(p.lessonId)} != ${p.actualMin}`);
      }
    }
  }
  if (mismatchCount === 0) console.log("Проверка: все пересчитанные уроки сходятся ровно с длительностью урока.");
  else process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
