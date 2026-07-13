#!/usr/bin/env node
// Промт 7.3 Часть 1 (расширено Промтом 7.4) — оценки за уроки с реальным
// содержанием (есть middle-этапы) в заданном диапазоне дат.
//
// Промт 7.4: раньше фильтровали по status='completed' — для 7-12 июля это
// было корректным сигналом "прошедший урок". Для 13-24 июля status
// физически не может стать 'completed' раньше реального наступления даты
// (fn_auto_end_lessons сработает сам, когда время естественно пройдёт) —
// поэтому сигнал "урок готов к оценкам" сменили на "есть ли контент"
// (middle-этапы), не дожидаясь смены статуса. lessons.status НЕ трогаем.
//
// node backfill-grades.mjs [fromDate] [toDate]   (toDate — исключая)
// Нет внешних API — шаблоны и рандом только локально.
import {
  makeServiceRoleClient, SCHOOL_ID, REAL_STUDENT_USERNAMES, GRADE_PROFILES, DEMO_GRADE_PROFILE,
  weightedPick, randomInt, GRADE_COMMENTS, maybeComment,
} from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

function addMinutesIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

async function main() {
  const fromDate = process.argv[2] ?? "2026-07-07";
  const toDate = process.argv[3] ?? "2026-07-25";

  const { data: allLessons, error: lessonsErr } = await db
    .from("lessons")
    .select("id, group_id, subject_id, starts_at, ends_at")
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

  const { data: beforeCount } = await db.from("lesson_grades").select("id", { count: "exact", head: true });
  console.log(`lesson_grades до backfill'а: ${beforeCount ?? "?"}`);

  const rows = [];
  for (const lesson of lessons) {
    const teacherId = teacherBySubject.get(lesson.subject_id) ?? curatorByGroup.get(lesson.group_id);
    if (!teacherId) continue;
    const studentIds = studentsByGroup.get(lesson.group_id) ?? [];
    for (const studentId of studentIds) {
      const username = usernameByStudent.get(studentId);
      const profile = REAL_STUDENT_USERNAMES.includes(username) ? GRADE_PROFILES[username] : DEMO_GRADE_PROFILE;
      const grade = Number(weightedPick(profile));
      rows.push({
        lesson_id: lesson.id,
        student_id: studentId,
        grade,
        comment: maybeComment(GRADE_COMMENTS, 0.4) || null,
        graded_by: teacherId,
        graded_at: addMinutesIso(lesson.ends_at ?? lesson.starts_at, randomInt(1, 30)),
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
      .from("lesson_grades")
      .upsert(chunk, { onConflict: "lesson_id,student_id", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error(`Чанк ${i}-${i + chunk.length} упал: ${error.message}`); continue; }
    inserted += data?.length ?? 0;
    console.log(`  чанк ${i}-${i + chunk.length}: +${data?.length ?? 0}`);
  }

  const { count: afterCount } = await db.from("lesson_grades").select("id", { count: "exact", head: true });
  console.log(`ИТОГО новых lesson_grades вставлено: ${inserted}`);
  console.log(`lesson_grades после backfill'а: ${afterCount}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
