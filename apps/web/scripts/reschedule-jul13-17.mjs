// ЧАСТЬ 3 — reschedule 2026-07-13..17 onto the same tight 55-min-cadence grid
// used by 18+ July (first slot 04:00 UTC = 09:00 Tashkent, 45-min lessons,
// parallel groups preserved per slot). Only updates starts_at/ends_at/duration_minutes
// on EXISTING rows via id — never inserts/deletes. Idempotent: target slots are
// recomputed deterministically from each day's distinct original start-time groups,
// so a second run maps every lesson to the same slot it's already in (no-op).
//
// Excluded by explicit id (stray test rows, confirmed with the requester to leave
// untouched): c6bb0fbd... (2026-07-15T19:05, room "123"), 71115db0... (2026-07-16T16:30, room "11").
//
// Usage: node scripts/reschedule-jul13-17.mjs [--dry-run]

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

const SLOT_CADENCE_MIN = 55;
const LESSON_DURATION_MIN = 45;
const FIRST_SLOT_UTC_HOUR = 4; // 04:00 UTC = 09:00 Tashkent (UTC+5)

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

async function main() {
  console.log(`Режим: ${DRY_RUN ? "DRY-RUN (без записи)" : "БОЕВОЙ (пишем в БД)"}`);

  const lessons = await sb(
    "lessons?select=id,starts_at,ends_at,duration_minutes,status,room,group_id,subject_id,topic" +
      "&starts_at=gte.2026-07-13T00:00:00Z&starts_at=lt.2026-07-18T00:00:00Z&order=starts_at.asc",
  );
  console.log(`Всего уроков 13-17 июля: ${lessons.length}`);

  // Identify strays by duration (5 min, way outside the 190/45 min pattern) —
  // confirmed manually against the investigation's exact ids.
  const strays = lessons.filter((l) => l.duration_minutes === 5);
  const strayIds = new Set(strays.map((l) => l.id));
  console.log(
    `Странные короткие уроки (исключены из перестановки): ${strays.map((l) => `${l.id.slice(0, 8)} @ ${l.starts_at}`).join(", ")}`,
  );

  const real = lessons.filter((l) => !strayIds.has(l.id));
  console.log(`Реальных уроков в перестановке: ${real.length}`);

  // Group by (date, starts_at) — preserves the "parallel group" structure.
  const byDay = new Map();
  for (const l of real) {
    const date = l.starts_at.slice(0, 10);
    if (!byDay.has(date)) byDay.set(date, new Map());
    const daySlots = byDay.get(date);
    if (!daySlots.has(l.starts_at)) daySlots.set(l.starts_at, []);
    daySlots.get(l.starts_at).push(l);
  }

  const updates = [];
  const days = [...byDay.keys()].sort();
  for (const date of days) {
    const daySlots = byDay.get(date);
    const slotTimes = [...daySlots.keys()].sort();
    console.log(`\n${date}: ${slotTimes.length} исходных слотов, ${[...daySlots.values()].flat().length} уроков`);
    slotTimes.forEach((oldSlot, i) => {
      const newStart = new Date(`${date}T00:00:00Z`);
      newStart.setUTCHours(FIRST_SLOT_UTC_HOUR, i * SLOT_CADENCE_MIN, 0, 0);
      const newStartIso = newStart.toISOString();
      const newEnd = new Date(newStart.getTime() + LESSON_DURATION_MIN * 60000).toISOString();

      const group = daySlots.get(oldSlot);
      console.log(`  ${oldSlot} → ${newStartIso}  (${group.length} уроков: ${group.map((l) => l.topic?.slice(0, 20)).join(" | ")})`);

      for (const l of group) {
        // Postgres returns "+00:00" offsets, JS toISOString() returns "Z" with
        // milliseconds — compare as instants, not strings, or every re-run
        // would falsely think nothing is already correct.
        const alreadyCorrect =
          new Date(l.starts_at).getTime() === newStart.getTime() &&
          new Date(l.ends_at).getTime() === new Date(newEnd).getTime() &&
          l.duration_minutes === LESSON_DURATION_MIN;
        updates.push({
          id: l.id,
          topic: l.topic,
          oldStart: l.starts_at,
          newStart: newStartIso,
          newEnd,
          alreadyCorrect,
        });
      }
    });
  }

  const toWrite = updates.filter((u) => !u.alreadyCorrect);
  console.log(`\nИтого к обновлению: ${toWrite.length} / ${updates.length} (остальные уже на месте — idempotent no-op)`);

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Ничего не записано. Пример первых 5 обновлений:");
    console.log(JSON.stringify(toWrite.slice(0, 5), null, 2));
    return;
  }

  let done = 0;
  for (const u of toWrite) {
    await sb(`lessons?id=eq.${u.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        starts_at: u.newStart,
        duration_minutes: LESSON_DURATION_MIN,
      }),
    });
    done++;
    if (done % 10 === 0) console.log(`  ...${done}/${toWrite.length}`);
  }
  console.log(`\nОбновлено уроков: ${done}`);

  // Verify: re-fetch and confirm ends_at was recomputed correctly by trg_compute_lesson_end.
  const verifyIds = toWrite.map((u) => u.id);
  const after = await sb(`lessons?select=id,starts_at,ends_at,duration_minutes&id=in.(${verifyIds.join(",")})`);
  const mismatches = after.filter((l) => {
    const expected = toWrite.find((u) => u.id === l.id);
    return (
      new Date(l.starts_at).getTime() !== new Date(expected.newStart).getTime() ||
      new Date(l.ends_at).getTime() !== new Date(expected.newEnd).getTime() ||
      l.duration_minutes !== LESSON_DURATION_MIN
    );
  });
  if (mismatches.length > 0) {
    console.error("ВНИМАНИЕ: несовпадения после записи:", JSON.stringify(mismatches, null, 2));
    process.exitCode = 1;
  } else {
    console.log("Проверка: все обновлённые уроки имеют корректные starts_at/ends_at/duration_minutes=45.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
