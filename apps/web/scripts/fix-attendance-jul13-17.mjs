#!/usr/bin/env node
// Пачка 2.5 — фикс кривой bulk-сидинговой attendance за 13-17 июля 2026.
// Переписывает записи, оставленные более ранним (не нашим) механизмом
// сидинга, на реалистичное распределение — чтобы следующий запуск
// backfill-historical-jul7-17.mjs смог досоздать lesson_grades/homework
// для реально присутствовавших учеников.
//
// Auth: service-role (как во всех остальных backfill-скриптах этой сессии).
//
// ЖИВАЯ ПРОВЕРКА ПЕРЕД НАПИСАНИЕМ (эта сессия, hosted БД, полная
// пагинация — не первые 1000 строк):
//   - Уроков 13-17 июля: 47. Всего attendance в этом диапазоне: 1504.
//   - Гейт marked_by IS NULL AND status='absent_unexcused': РОВНО 1380
//     строк (не ~1440, как предполагалось). marked_by IS NULL САМ ПО СЕБЕ
//     (без фильтра по статусу) даёт ТЕ ЖЕ 1380 — ни одной строки с
//     marked_by=NULL и другим статусом нет, гейт однозначный и чистый.
//   - 11 строк — marked_by IS NOT NULL И status=absent_unexcused
//     (органичные, настоящие неявки, отмеченные учителем) — НЕ трогаем.
//   - 112 present + 1 absent_excused — тоже органичные, marked_by
//     заполнен — НЕ трогаем. 1380+112+1+11=1504, сходится.
//
// СХЕМА (важные расхождения с исходным промтом, подтверждены
// live-запросом и миграциями):
//   - attendance НЕ имеет колонок created_at/updated_at вообще (только
//     recorded_at и marked_at). "updated_at = случайный timestamp в
//     течение урока" реализовано через marked_at (это и есть поле,
//     выдавшее bulk-сидинг — идентичные/дробно-секундные значения не по
//     конкретному ученику). recorded_at (ближайший аналог created_at) —
//     НЕ трогаем, как и просили ("created_at не менять").
//   - attendance_status — НЕ native enum на практике: миграция
//     20260614000001_enums.sql создавала enum ('present','absent','late'),
//     но миграция 20260623000043_remove_late_status.sql заменила его на
//     text + CHECK (status IN ('present','absent_excused',
//     'absent_unexcused')) — 'late' убрали, 'sick' в этой схеме НИКОГДА
//     не существовал. 'sick' из промта — сводим в 'absent_excused' (та
//     же конвенция, что уже задокументирована в
//     scripts/lib/backfill-templates.mjs и в backfill-historical.mjs:
//     absent_excused = "sick"/справка из ТЗ). Итоговое распределение:
//     present=90%, absent_excused=5% (3%+2% sick слиты), absent_unexcused=5%.
//   - teacher_id урока — та же резолюция, что в backfill-historical-
//     jul7-17.mjs: subjects.teacher_id по subject_id урока, иначе
//     groups.teacher_id (куратор) — lessons.teacher_id НЕ существует
//     как колонка (см. диагностику предыдущего хода).

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFallback() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const envFallback = loadEnvFallback();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFallback.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFallback.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FATAL: нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Запускай так: node --env-file=.env.local scripts/fix-attendance-jul13-17.mjs [--dry-run|--confirm]");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, def) {
  const pfx = `--${name}=`;
  const found = argv.find((a) => a.startsWith(pfx));
  return found ? found.slice(pfx.length) : def;
}
const CONFIRM = flag("confirm");
const EXPLICIT_DRY = flag("dry-run");
const DRY_RUN = !CONFIRM || EXPLICIT_DRY;
if (CONFIRM && EXPLICIT_DRY) {
  console.warn("Указаны и --confirm, и --dry-run одновременно — выигрывает dry-run (безопаснее).");
}
const START_DATE = opt("date-from", "2026-07-13");
const END_DATE = opt("date-to", "2026-07-17"); // inclusive
const TZ_OFFSET = "+05:00";
const rangeStartIso = `${START_DATE}T00:00:00${TZ_OFFSET}`;
const rangeEndExclusiveIso = new Date(new Date(`${END_DATE}T00:00:00${TZ_OFFSET}`).getTime() + 86400000).toISOString();

console.log("═".repeat(70));
console.log(`Фикс bulk-сидинговой attendance ${START_DATE}..${END_DATE}`);
console.log(`Режим: ${DRY_RUN ? "DRY-RUN (ничего не пишем в БД)" : "БОЕВОЙ (пишем в БД)"}`);
console.log("═".repeat(70));

// ── распределение: present 90%, absent_excused 5% (3%+2% sick слиты),
// absent_unexcused 5% ────────────────────────────────────────────────────
function pickStatus() {
  const r = Math.random();
  if (r < 0.90) return "present";
  if (r < 0.95) return "absent_excused";
  return "absent_unexcused";
}
function randomInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

async function fetchAllRows(table, selectCols, applyFilters) {
  const PAGE = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = db.from(table).select(selectCols).range(from, from + PAGE - 1);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAllRows(${table}): ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const BATCH_SIZE = 200;
async function flushUpdates(queue, stats) {
  while (queue.length > 0) {
    const chunk = queue.splice(0, Math.min(BATCH_SIZE, queue.length));
    if (DRY_RUN) { stats.updated += chunk.length; continue; }
    const { error } = await db.from("attendance").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`  ОШИБКА при UPDATE ${chunk.length} строк: ${error.message}`);
      stats.errors += chunk.length;
      continue;
    }
    stats.updated += chunk.length;
  }
}

async function main() {
  const startedAt = Date.now();

  const lessons = await fetchAllRows(
    "lessons", "id, subject_id, group_id, starts_at",
    (q) => q.gte("starts_at", rangeStartIso).lt("starts_at", rangeEndExclusiveIso),
  );
  console.log(`\nУроков в диапазоне: ${lessons.length}`);
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const lessonIds = lessons.map((l) => l.id);

  const subjects = await fetchAllRows("subjects", "id, teacher_id", (q) => q.eq("is_stub", false));
  const teacherBySubject = new Map(subjects.map((s) => [s.id, s.teacher_id]));
  const groups = await fetchAllRows("groups", "id, teacher_id", (q) => q);
  const curatorByGroup = new Map(groups.map((g) => [g.id, g.teacher_id]));
  const groupNames = await fetchAllRows("groups", "id, name", (q) => q);
  const groupNameById = new Map(groupNames.map((g) => [g.id, g.name]));

  // Гейт: marked_by IS NULL AND status='absent_unexcused' (подтверждено
  // live — совпадает 1:1 с "marked_by IS NULL" без доп. фильтра, но
  // фильтруем явно по обоим условиям, как в промте, для документальной
  // точности гейта).
  const dirtyRows = await fetchAllRows(
    "attendance", "id, lesson_id, student_id, status, marked_by",
    (q) => q.in("lesson_id", lessonIds).is("marked_by", null).eq("status", "absent_unexcused"),
  );
  console.log(`Строк под гейтом (marked_by IS NULL AND status='absent_unexcused'): ${dirtyRows.length}`);

  const byLesson = new Map();
  for (const r of dirtyRows) {
    const arr = byLesson.get(r.lesson_id) ?? [];
    arr.push(r);
    byLesson.set(r.lesson_id, arr);
  }

  const stats = { updated: 0, errors: 0 };
  const totalByStatus = { present: 0, absent_excused: 0, absent_unexcused: 0 };
  const queue = [];

  const lessonsWithDirty = [...byLesson.keys()];
  for (let i = 0; i < lessonsWithDirty.length; i++) {
    const lessonId = lessonsWithDirty[i];
    const lesson = lessonById.get(lessonId);
    const rows = byLesson.get(lessonId);
    const teacherId = teacherBySubject.get(lesson.subject_id) ?? curatorByGroup.get(lesson.group_id) ?? null;
    const dateLabel = lesson.starts_at.slice(0, 10);
    const groupName = groupNameById.get(lesson.group_id) ?? "?";

    let present = 0, excused = 0, unexcused = 0;
    for (const row of rows) {
      const newStatus = pickStatus();
      if (newStatus === "present") present++;
      else if (newStatus === "absent_excused") excused++;
      else unexcused++;

      const newMarkedAt = new Date(new Date(lesson.starts_at).getTime() + randomInt(0, 30) * 60000).toISOString();
      queue.push({
        id: row.id,
        student_id: row.student_id,
        lesson_id: row.lesson_id,
        status: newStatus,
        marked_by: teacherId,
        marked_at: newMarkedAt,
      });
    }
    totalByStatus.present += present;
    totalByStatus.absent_excused += excused;
    totalByStatus.absent_unexcused += unexcused;

    await flushUpdates(queue, stats);
    console.log(`[${i + 1}/${lessonsWithDirty.length}] ${dateLabel} · ${groupName} → updated ${rows.length} records (present=${present}, absent_excused=${excused}, absent_unexcused=${unexcused})`);
  }
  await flushUpdates(queue, stats);

  console.log("\n" + "═".repeat(70));
  console.log("ИТОГ:");
  console.log(`  Всего обновлено: ${stats.updated}`);
  console.log(`  Разбивка по новым статусам: present=${totalByStatus.present}, absent_excused=${totalByStatus.absent_excused}, absent_unexcused=${totalByStatus.absent_unexcused}`);
  console.log(`  Ошибок: ${stats.errors}`);
  console.log(`  Время: ${((Date.now() - startedAt) / 1000).toFixed(1)}с`);

  if (!DRY_RUN) {
    const check = await fetchAllRows("attendance", "status", (q) => q.in("lesson_id", lessonIds));
    const checkCounts = {};
    for (const r of check) checkCounts[r.status] = (checkCounts[r.status] ?? 0) + 1;
    console.log(`  Проверка после UPDATE (вся attendance 13-17): ${JSON.stringify(checkCounts)}`);
  }
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
