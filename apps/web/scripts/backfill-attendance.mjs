#!/usr/bin/env node
// Промт 7.3 Часть 2 (расширено Промтом 7.4) — посещаемость за уроки с
// реальным содержанием в заданном диапазоне дат (см. комментарий в
// backfill-grades.mjs про смену сигнала status='completed' → "есть
// контент" для будущих дат).
//
// Промт 7.5: схема НЕ содержит статус 'late' (удалён миграцией 43,
// подтверждено прямым SELECT на pg_constraint — живой CHECK допускает
// только 'present'/'absent_excused'/'absent_unexcused'). Веса по Промту
// 7.4: 90% present, 7% absent_excused, 3% absent_unexcused.
//
// node backfill-attendance.mjs [fromDate] [toDate]   (toDate — исключая)
import { makeServiceRoleClient, SCHOOL_ID, REAL_STUDENT_USERNAMES } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

const STATUS_WEIGHTS = { present: 0.90, absent_excused: 0.07, absent_unexcused: 0.03 };
function pickStatus() {
  const r = Math.random();
  let acc = 0;
  for (const [status, w] of Object.entries(STATUS_WEIGHTS)) {
    acc += w;
    if (r <= acc) return status;
  }
  return "present";
}

async function main() {
  const fromDate = process.argv[2] ?? "2026-07-07";
  const toDate = process.argv[3] ?? "2026-07-25";

  const { data: allLessons, error: lessonsErr } = await db
    .from("lessons")
    .select("id, group_id, subject_id, starts_at")
    .gte("starts_at", `${fromDate}T00:00:00+05:00`)
    .lt("starts_at", `${toDate}T00:00:00+05:00`)
    .order("starts_at", { ascending: true });
  if (lessonsErr) throw lessonsErr;

  const { data: stageRows } = await db.from("lesson_stages").select("lesson_id").eq("stage_role", "middle");
  const hasContent = new Set((stageRows ?? []).map((r) => r.lesson_id));
  const lessons = allLessons.filter((l) => hasContent.has(l.id));
  console.log(`Уроков в диапазоне ${fromDate}..${toDate} с контентом: ${lessons.length} (из ${allLessons.length} всего)`);

  const subjectIds = [...new Set(lessons.map((l) => l.subject_id).filter(Boolean))];
  const { data: subjects } = await db.from("subjects").select("id, teacher_id").in("id", subjectIds);
  const teacherBySubject = new Map((subjects ?? []).map((s) => [s.id, s.teacher_id]));

  const groupIds = [...new Set(lessons.map((l) => l.group_id))];
  const { data: groups } = await db.from("groups").select("id, teacher_id").in("id", groupIds);
  const curatorByGroup = new Map((groups ?? []).map((g) => [g.id, g.teacher_id]));

  const { data: sgRows } = await db.from("student_groups").select("student_id, group_id").in("group_id", groupIds);
  const { data: students } = await db.from("students").select("id, username").in("id", (sgRows ?? []).map((r) => r.student_id));
  const usernameByStudent = new Map((students ?? []).map((s) => [s.id, s.username]));
  const studentsByGroup = new Map();
  for (const r of sgRows ?? []) {
    const arr = studentsByGroup.get(r.group_id) ?? [];
    arr.push(r.student_id);
    studentsByGroup.set(r.group_id, arr);
  }

  const rows = [];
  for (const lesson of lessons) {
    const teacherId = teacherBySubject.get(lesson.subject_id) ?? curatorByGroup.get(lesson.group_id) ?? null;
    const studentIds = studentsByGroup.get(lesson.group_id) ?? [];
    for (const studentId of studentIds) {
      const username = usernameByStudent.get(studentId);
      rows.push({
        lesson_id: lesson.id,
        student_id: studentId,
        status: pickStatus(),
        marked_at: lesson.starts_at,
        marked_by: teacherId,
        school_id: SCHOOL_ID,
        is_demo: !REAL_STUDENT_USERNAMES.includes(username),
      });
    }
  }
  console.log(`Кандидатов на вставку (lesson x student): ${rows.length}`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("attendance")
      .upsert(chunk, { onConflict: "student_id,lesson_id", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error(`Чанк ${i}-${i + chunk.length} упал: ${error.message}`); continue; }
    inserted += data?.length ?? 0;
    console.log(`  чанк ${i}-${i + chunk.length}: +${data?.length ?? 0}`);
  }

  const { count: afterCount } = await db.from("attendance").select("id", { count: "exact", head: true });
  console.log(`ИТОГО новых attendance вставлено: ${inserted}`);
  console.log(`attendance после backfill'а: ${afterCount}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
