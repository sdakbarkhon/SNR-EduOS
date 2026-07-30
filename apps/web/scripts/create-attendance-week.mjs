#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 8 — посещаемость для всех уроков со статусом
// 'completed' (27-29 июля). Будущие уроки (30.07-02.08, status='scheduled')
// не трогаем — они ещё не прошли.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки схемы — packages/core/src/database.types.ts,
// supabase/migrations/20260614000004_attendance.sql, 20260619000027_attendance.sql,
// 20260623000042/43_*, живой AttendanceView.tsx):
//
//   1) Статусов "present/absent/late/sick" в схеме НЕТ. Исходный enum
//      ('present','absent','late') был заменён text+CHECK миграцией 27, а
//      финальный CHECK (миграция 43, "убрать late окончательно") допускает
//      РОВНО ТРИ значения: 'present', 'absent_excused', 'absent_unexcused'.
//      'sick' никогда не было валидным значением само по себе — упомянутое
//      в промте "sick — не создаём" не про существующую, а про никогда не
//      существовавшую опцию. AttendanceView.tsx (apps/web/app/(app)/attendance/)
//      подтверждает: ровно эти 3 статуса, разный цвет (present=зелёный,
//      absent_excused=жёлтый, absent_unexcused=красный). Для "5% пропустил"
//      использован 'absent_excused' (жёлтый, не тревожный — уважительная
//      причина выглядит презентабельнее для демо, чем 'absent_unexcused').
//
//   2) Найден уже существующий apps/web/scripts/backfill-attendance.mjs —
//      НО он вставляет колонку is_demo, которой в attendance больше НЕТ
//      (удалена миграцией 132_remove_demo_infra_convert_demo_to_real.sql —
//      тот же паттерн, что и is_demo на homework_submissions, см. Этап 7).
//      Скрипт устарел и сейчас упал бы на insert. Использую актуальную
//      схему (проверено live через database.types.ts): lesson_id,
//      student_id, school_id, status, marked_at, marked_by, is_finalized —
//      recorded_at имеет DB default, не задаю явно.
//
//   3) is_finalized=true — по прецеденту самой миграции 27 ("seed rows are
//      historical, mark as finalized") — эти записи не "текущая
//      перекличка", а уже прошедшие уроки.
//
//   4) Идемпотентность — upsert(onConflict: "student_id,lesson_id",
//      ignoreDuplicates: true) прямо на UNIQUE-констрейнт таблицы (тот же
//      приём, что и в backfill-attendance.mjs) — проще и надёжнее
//      отдельного check-then-insert.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-attendance-week.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const STATUS_WEIGHTS = { present: 0.95, absent_excused: 0.05 };

// ── seeded PRNG (xmur3+mulberry32) — тот же паттерн, что в create-schedule-week.mjs / fix-homework-uniform.mjs ──
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
function seededStatus(seedStr) {
  const r = seededRng(seedStr);
  let acc = 0;
  for (const [status, w] of Object.entries(STATUS_WEIGHTS)) { acc += w; if (r <= acc) return status; }
  return "present";
}

async function main() {
  console.log(`Посещаемость для completed-уроков — демо-школа (${SCHOOL_ID})\n`);

  const { data: lessons, error: lErr } = await db
    .from("lessons")
    .select("id, group_id, subject_id, starts_at")
    .eq("school_id", SCHOOL_ID)
    .eq("status", "completed")
    .order("starts_at");
  if (lErr) fail(`Ошибка запроса lessons: ${lErr.message}`);
  console.log(`Уроков со статусом 'completed': ${lessons.length} (ожидание 54 = 3 группы × 3 дня × 6 уроков).`);
  if (lessons.length === 0) { console.log("Нечего делать."); return; }

  const subjectIds = [...new Set(lessons.map((l) => l.subject_id).filter(Boolean))];
  const { data: subjects, error: sErr } = await db.from("subjects").select("id, teacher_id").in("id", subjectIds);
  if (sErr) fail(`Ошибка запроса subjects: ${sErr.message}`);
  const teacherBySubject = new Map(subjects.map((s) => [s.id, s.teacher_id]));

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
    const teacherId = teacherBySubject.get(lesson.subject_id) ?? null;
    const studentIds = studentsByGroup.get(lesson.group_id) ?? [];
    for (const studentId of studentIds) {
      rows.push({
        lesson_id: lesson.id,
        student_id: studentId,
        school_id: SCHOOL_ID,
        status: seededStatus(`${studentId}|${lesson.id}`),
        marked_at: lesson.starts_at,
        marked_by: teacherId,
        is_finalized: true,
      });
    }
  }
  console.log(`Кандидатов на вставку (урок × ученик): ${rows.length}.\n`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("attendance")
      .upsert(chunk, { onConflict: "student_id,lesson_id", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error(`  !! чанк ${i}-${i + chunk.length} упал: ${error.message}`); continue; }
    inserted += data?.length ?? 0;
    console.log(`  чанк ${i}-${i + chunk.length}: +${data?.length ?? 0} (уже было: ${chunk.length - (data?.length ?? 0)})`);
  }

  console.log(`\nГотово: новых вставлено ${inserted} из ${rows.length} кандидатов (остальные — уже существовали, идемпотентно).`);

  const lessonIds = lessons.map((l) => l.id);
  const { count: totalCount } = await db.from("attendance").select("*", { count: "exact", head: true }).in("lesson_id", lessonIds);
  const { data: byLesson } = await db.from("attendance").select("lesson_id, status").in("lesson_id", lessonIds);
  const countByLesson = new Map();
  const statusCounts = {};
  for (const r of byLesson) {
    countByLesson.set(r.lesson_id, (countByLesson.get(r.lesson_id) ?? 0) + 1);
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  const badLessons = lessonIds.filter((id) => (countByLesson.get(id) ?? 0) !== 10);

  console.log(`\nПроверка: attendance для completed-уроков всего — ${totalCount} (ожидание ~540).`);
  console.log(`По статусам: ${JSON.stringify(statusCounts)}.`);
  console.log(`Уроков НЕ ровно с 10 записями: ${badLessons.length} (ожидание 0).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
