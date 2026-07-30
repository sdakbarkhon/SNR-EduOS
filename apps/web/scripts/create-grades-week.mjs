#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 9 Часть A — оценки за уроки (lesson_grades) для
// всех 54 уроков со статусом 'completed' (27-29 июля), все 10 учеников
// каждой группы, без показательных случаев — все ученики равноправны.
//
// СХЕМА (supabase/migrations/20260623000040_lesson_grades.sql,
// database.types.ts): lesson_id, student_id (оба NOT NULL, UNIQUE
// вместе), grade int CHECK BETWEEN 1 AND 5, comment (nullable, не
// заполняем — не запрошено), graded_by uuid NOT NULL REFERENCES teachers
// (обязательно — под service-role нет current_teacher_id(), берём
// subjects.teacher_id урока), graded_at/updated_at — DB default now().
// school_id — тот же универсальный паттерн (71/72), задаём явно.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-grades-week.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const GRADE_WEIGHTS = { 5: 0.30, 4: 0.40, 3: 0.25, 2: 0.05 };

// ── seeded PRNG (xmur3+mulberry32) — тот же паттерн, что в create-attendance-week.mjs ──
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRng(seedStr) { return mulberry32(xmur3(seedStr)())(); }
function seededGrade(seedStr) {
  const r = seededRng(seedStr);
  let acc = 0;
  for (const [grade, w] of Object.entries(GRADE_WEIGHTS)) { acc += w; if (r <= acc) return Number(grade); }
  return 4;
}

async function main() {
  console.log(`Оценки за уроки — демо-школа (${SCHOOL_ID})\n`);

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, group_id, subject_id")
    .eq("school_id", SCHOOL_ID)
    .eq("status", "completed")
    .order("starts_at");
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  console.log(`Уроков со статусом 'completed': ${lessons.length} (ожидание 54).`);
  if (lessons.length === 0) { console.log("Нечего делать."); return; }

  const subjectIds = [...new Set(lessons.map((l) => l.subject_id).filter(Boolean))];
  const { data: subjects, error: sErr } = await db.from("subjects").select("id, teacher_id").in("id", subjectIds);
  if (sErr) fail(`Ошибка запроса subjects: ${sErr.message}`);
  const teacherBySubject = new Map(subjects.map((s) => [s.id, s.teacher_id]));
  const missingTeacher = subjectIds.filter((id) => !teacherBySubject.get(id));
  if (missingTeacher.length > 0) fail(`У предметов без teacher_id (graded_by NOT NULL): ${missingTeacher.join(", ")}`);

  const groupIds = [...new Set(lessons.map((l) => l.group_id))];
  const { data: sgRows, error: sgErr } = await db.from("student_groups").select("student_id, group_id").in("group_id", groupIds);
  if (sgErr) fail(`Ошибка запроса student_groups: ${sgErr.message}`);
  const studentsByGroup = new Map();
  for (const r of sgRows) {
    if (!studentsByGroup.has(r.group_id)) studentsByGroup.set(r.group_id, []);
    studentsByGroup.get(r.group_id).push(r.student_id);
  }
  for (const gid of groupIds) {
    const n = studentsByGroup.get(gid)?.length ?? 0;
    if (n !== 10) console.warn(`  !! Группа ${gid}: ${n} учеников (ожидание 10).`);
  }

  const rows = [];
  for (const lesson of lessons) {
    const teacherId = teacherBySubject.get(lesson.subject_id);
    const studentIds = studentsByGroup.get(lesson.group_id) ?? [];
    for (const studentId of studentIds) {
      rows.push({
        lesson_id: lesson.id,
        student_id: studentId,
        school_id: SCHOOL_ID,
        grade: seededGrade(`${studentId}|${lesson.id}`),
        graded_by: teacherId,
      });
    }
  }
  console.log(`Кандидатов на вставку (урок × ученик): ${rows.length}.\n`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("lesson_grades")
      .upsert(chunk, { onConflict: "lesson_id,student_id", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error(`  !! чанк ${i}-${i + chunk.length} упал: ${error.message}`); continue; }
    inserted += data?.length ?? 0;
    console.log(`  чанк ${i}-${i + chunk.length}: +${data?.length ?? 0} (уже было: ${chunk.length - (data?.length ?? 0)})`);
  }
  console.log(`\nГотово: новых вставлено ${inserted} из ${rows.length} кандидатов.`);

  const lessonIds = lessons.map((l) => l.id);
  const { count: totalCount } = await db.from("lesson_grades").select("*", { count: "exact", head: true }).in("lesson_id", lessonIds);
  const { data: allGrades } = await db.from("lesson_grades").select("lesson_id, grade").in("lesson_id", lessonIds);
  const countByLesson = new Map();
  const gradeCounts = {};
  for (const r of allGrades) {
    countByLesson.set(r.lesson_id, (countByLesson.get(r.lesson_id) ?? 0) + 1);
    gradeCounts[r.grade] = (gradeCounts[r.grade] ?? 0) + 1;
  }
  const badLessons = lessonIds.filter((id) => (countByLesson.get(id) ?? 0) !== 10);

  console.log(`\nПроверка: lesson_grades для completed-уроков всего — ${totalCount} (ожидание 540).`);
  console.log(`По оценкам: ${JSON.stringify(gradeCounts)} (ожидание ~30/40/25/5% для 5/4/3/2).`);
  console.log(`Уроков НЕ ровно с 10 оценками: ${badLessons.length} (ожидание 0).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
