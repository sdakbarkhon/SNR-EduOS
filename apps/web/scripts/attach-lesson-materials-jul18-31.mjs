#!/usr/bin/env node
// Пачка «240 пустых уроков», ЧАСТЬ 3 — ретро-скрипт: прицепляет к каждому
// уроку 18-31 июля 2026 до 3 книг Базы знаний того же предмета. БЕЗ Gemini
// — чистое сопоставление lessons.subject_id -> subjects.name -> books.subject
// (см. attachBooksToLesson/SUBJECT_NAME_TO_BOOK_SLUG в _backfill-shared.mjs).
// Идемпотентно: уроки, у которых уже есть kb_bucket='books' материал,
// пропускаются целиком.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/attach-lesson-materials-jul18-31.mjs --dry-run
//   node --env-file=.env.local scripts/attach-lesson-materials-jul18-31.mjs --confirm

import { makeServiceRoleClient, SCHOOL_ID, attachBooksToLesson } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

const argv = process.argv.slice(2);
const CONFIRM = argv.includes("--confirm");
const DRY_RUN = !CONFIRM || argv.includes("--dry-run");

const RANGE_START = "2026-07-18T00:00:00+05:00";
const RANGE_END_EXCLUSIVE = "2026-08-01T00:00:00+05:00";

async function main() {
  console.log("═".repeat(70));
  console.log(`Материалы урока из БЗ — 18-31.07.2026 (${DRY_RUN ? "DRY-RUN" : "БОЕВОЙ"})`);
  console.log("═".repeat(70));

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, starts_at, subject:subjects(name)")
    .gte("starts_at", RANGE_START)
    .lt("starts_at", RANGE_END_EXCLUSIVE)
    .order("starts_at", { ascending: true });
  if (lErr) throw new Error(`fetch lessons: ${lErr.message}`);
  console.log(`Уроков в диапазоне: ${lessons.length}`);

  // teacher_id по предмету — subjects.teacher_id (для атрибуции uploaded_by,
  // необязательно, но корректнее null'а).
  const { data: subjectRows, error: sErr } = await db.from("subjects").select("id, name, teacher_id");
  if (sErr) throw new Error(`fetch subjects: ${sErr.message}`);
  const teacherIdByName = new Map();
  for (const s of subjectRows ?? []) {
    if (s.teacher_id && !teacherIdByName.has(s.name)) teacherIdByName.set(s.name, s.teacher_id);
  }

  const bySubject = {};
  let attachedLessons = 0, alreadyHad = 0, noSlug = 0, noBooks = 0, totalRowsInserted = 0;

  for (const lesson of lessons) {
    const subjectName = lesson.subject?.name ?? null;
    bySubject[subjectName ?? "(нет предмета)"] ??= { total: 0, attached: 0 };
    bySubject[subjectName ?? "(нет предмета)"].total++;

    if (DRY_RUN) {
      // Dry-run: показываем что БЫЛО БЫ, не пишем в БД.
      continue;
    }

    const result = await attachBooksToLesson(db, {
      lessonId: lesson.id,
      subjectName,
      teacherId: teacherIdByName.get(subjectName ?? "") ?? null,
      maxBooks: 3,
    });
    if (result.reason === "already_has_materials") alreadyHad++;
    else if (result.reason === "no_slug_mapping") noSlug++;
    else if (result.reason === "no_books_for_subject") noBooks++;
    else if (result.attached > 0) {
      attachedLessons++;
      totalRowsInserted += result.attached;
      bySubject[subjectName].attached++;
    }
  }

  console.log("\n=== По предметам (кол-во уроков в диапазоне) ===");
  for (const [name, s] of Object.entries(bySubject)) {
    console.log(`  ${name}: ${s.total} уроков${DRY_RUN ? "" : `, материалы прицеплены к ${s.attached}`}`);
  }

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] БД не менялась. Запусти с --confirm для реального прогона.`);
  } else {
    console.log("\n=== ИТОГ ===");
    console.log(`  Урокам прицеплены материалы: ${attachedLessons} (всего строк lesson_materials: ${totalRowsInserted})`);
    console.log(`  Уже были материалы (пропущено): ${alreadyHad}`);
    console.log(`  Нет книг для предмета (0 в БЗ): ${noBooks}`);
    console.log(`  Предмет не смаппился на slug: ${noSlug}`);
  }
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
