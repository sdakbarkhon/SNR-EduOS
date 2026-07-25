// Общая логика "закрыть уроки" — вытащена из
// apps/web/app/api/cron/close-past-lessons/route.ts, чтобы её могли
// переиспользовать и полуночный крон (закрытие всех уроков прошедших дней),
// и утренний крон/фолбэк (закрытие первого урока перед стартом второго),
// и endpoint start-with-close-previous (закрытие предыдущего урока, когда
// учитель/ученик стартует следующий).
//
// Все операции идемпотентны:
//   - UPDATE lessons SET status='completed' ... WHERE status != 'completed'
//     (guard в WHERE — повторный вызов ничего не трогает у уже закрытых);
//   - upsert attendance/lesson_grades с ignoreDuplicates:true (существующие
//     (student, lesson) пары не переписываются).
//
// school_id для attendance/lesson_grades задаётся ЯВНО из данных ученика
// (реф миграция 71 — NOT NULL, без явной подстановки вставка упала бы).

import type { SupabaseClient } from "@supabase/supabase-js";

/** Пороговые вероятности распределения статусов — сохранены из cron-роута. */
export function pickAttStatus(r: number): "present" | "absent_unexcused" | "absent_excused" {
  if (r < 0.9) return "present";
  if (r < 0.98) return "absent_unexcused";
  return "absent_excused";
}
/** Пороговые вероятности распределения оценок — сохранены из cron-роута. */
export function pickGrade(r: number): number {
  if (r < 0.3) return 5;
  if (r < 0.7) return 4;
  if (r < 0.95) return 3;
  return 2;
}

/** Досоздаёт посещаемость + оценки за урок для набора уроков. Идемпотентно.
 *  Caller уже отфильтровал окно (например, только уроки, которые мы только
 *  что перевели в 'completed') — здесь никаких дополнительных временных
 *  гейтов нет. Возвращает счётчики.  admin — service-role client. */
export async function fillAttendanceAndGrades(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  lessonIds: string[],
): Promise<{ attCreated: number; gradesCreated: number; skippedNoTeacher: number }> {
  if (lessonIds.length === 0) return { attCreated: 0, gradesCreated: 0, skippedNoTeacher: 0 };

  // group_id нам нужен, чтобы найти учеников группы и учителя-графера — для
  // caller'а (endpoint/крон) это лишние поля, здесь берём сами.
  const { data: lessonsRows, error: lErr } = await admin
    .from("lessons").select("id, group_id").in("id", lessonIds);
  if (lErr) throw new Error(`lessons for fill: ${lErr.message}`);
  const lessons = (lessonsRows ?? []) as Array<{ id: string; group_id: string }>;
  if (lessons.length === 0) return { attCreated: 0, gradesCreated: 0, skippedNoTeacher: 0 };

  const groupIds = [...new Set(lessons.map((l) => l.group_id))];

  // Ученики групп + школа ученика.
  const { data: sgRows, error: sgErr } = await admin
    .from("student_groups").select("group_id, student_id").in("group_id", groupIds);
  if (sgErr) throw new Error(`student_groups: ${sgErr.message}`);
  const { data: studentRows, error: stErr } = await admin
    .from("students").select("id, school_id")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .in("id", [...new Set((sgRows ?? []).map((r: any) => r.student_id))]);
  if (stErr) throw new Error(`students: ${stErr.message}`);
  const schoolByStudent = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (studentRows ?? []).map((s: any) => [s.id, s.school_id]),
  );
  const studentsByGroup = new Map<string, string[]>();
  for (const r of sgRows ?? []) {
    if (!studentsByGroup.has(r.group_id)) studentsByGroup.set(r.group_id, []);
    studentsByGroup.get(r.group_id)!.push(r.student_id);
  }

  // Учитель группы (graded_by для lesson_grades — NOT NULL).
  const { data: groupRows, error: gErr } = await admin
    .from("groups").select("id, teacher_id").in("id", groupIds);
  if (gErr) throw new Error(`groups: ${gErr.message}`);
  const teacherByGroup = new Map<string, string | null>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (groupRows ?? []).map((g: any) => [g.id, g.teacher_id]),
  );

  // Существующие attendance/оценки — для идемпотентности.
  const ids = lessons.map((l) => l.id);
  const { data: existAtt, error: aErr } = await admin
    .from("attendance").select("lesson_id, student_id, status").in("lesson_id", ids);
  if (aErr) throw new Error(`attendance read: ${aErr.message}`);
  const attByLesson = new Map<string, Map<string, string>>(); // lesson -> (student -> status)
  for (const r of existAtt ?? []) {
    if (!attByLesson.has(r.lesson_id)) attByLesson.set(r.lesson_id, new Map());
    attByLesson.get(r.lesson_id)!.set(r.student_id, r.status);
  }
  const { data: existLg, error: lgErr } = await admin
    .from("lesson_grades").select("lesson_id, student_id").in("lesson_id", ids);
  if (lgErr) throw new Error(`lesson_grades read: ${lgErr.message}`);
  const lgByLesson = new Map<string, Set<string>>();
  for (const r of existLg ?? []) {
    if (!lgByLesson.has(r.lesson_id)) lgByLesson.set(r.lesson_id, new Set());
    lgByLesson.get(r.lesson_id)!.add(r.student_id);
  }

  const attRows: Array<Record<string, unknown>> = [];
  const gradeRows: Array<Record<string, unknown>> = [];
  let skippedNoTeacher = 0;

  for (const lesson of lessons) {
    const students = studentsByGroup.get(lesson.group_id) ?? [];
    const existing = attByLesson.get(lesson.id) ?? new Map<string, string>();
    const presentStudents: string[] = [];
    // present из уже существующих строк — тоже кандидаты на оценку.
    for (const [sid, status] of existing) if (status === "present") presentStudents.push(sid);

    for (const sid of students) {
      if (existing.has(sid)) continue; // уже есть отметка — не трогаем (идемпотентно)
      const status = pickAttStatus(Math.random());
      const school = schoolByStudent.get(sid);
      if (!school) continue; // без school_id вставка упадёт (NOT NULL) — пропуск
      attRows.push({ lesson_id: lesson.id, student_id: sid, status, school_id: school });
      if (status === "present") presentStudents.push(sid);
    }

    // Оценки — ~35% присутствовавших, у кого ещё нет оценки за этот урок.
    const teacherId = teacherByGroup.get(lesson.group_id);
    if (!teacherId) { skippedNoTeacher++; continue; }
    const alreadyGraded = lgByLesson.get(lesson.id) ?? new Set<string>();
    for (const sid of presentStudents) {
      if (alreadyGraded.has(sid)) continue;
      if (Math.random() >= 0.35) continue;
      const school = schoolByStudent.get(sid);
      if (!school) continue;
      gradeRows.push({
        lesson_id: lesson.id, student_id: sid,
        grade: pickGrade(Math.random()), graded_by: teacherId, school_id: school,
      });
    }
  }

  let attCreated = 0;
  for (let i = 0; i < attRows.length; i += 500) {
    const batch = attRows.slice(i, i + 500);
    const { error } = await admin.from("attendance")
      .upsert(batch, { onConflict: "student_id,lesson_id", ignoreDuplicates: true });
    if (error) throw new Error(`attendance insert: ${error.message}`);
    attCreated += batch.length;
  }
  let gradesCreated = 0;
  for (let i = 0; i < gradeRows.length; i += 500) {
    const batch = gradeRows.slice(i, i + 500);
    const { error } = await admin.from("lesson_grades")
      .upsert(batch, { onConflict: "lesson_id,student_id", ignoreDuplicates: true });
    if (error) throw new Error(`lesson_grades insert: ${error.message}`);
    gradesCreated += batch.length;
  }
  return { attCreated, gradesCreated, skippedNoTeacher };
}

/** Полное закрытие набора уроков: перевод в 'completed' + досоздание
 *  attendance/оценок. Идемпотентно — уроки, которые уже 'completed', не
 *  трогает (attendance/оценки за них тоже не пересобирает — только для тех,
 *  кого UPDATE реально переключил).
 *
 *  Возвращает: closed — сколько уроков реально закрыто этим вызовом (UPDATE
 *  affected rows), attendanceCreated/gradesCreated — счётчики от fill.
 *
 *  Тонкость: .select("id") на UPDATE обязателен — Supabase без него отдаёт
 *  data:null, и вычислить кого именно закрыли (для последующего fill) стало
 *  бы невозможно. Silent-fail (реф 5222b73) — тоже прикрыт: если RLS/where
 *  отклонили всё, data=[] без error, closed=0, fill не вызовется, но и не
 *  упадёт (fillAttendanceAndGrades с пустым массивом сразу возвращает нули).
 */
export async function completeLessons(
  admin: SupabaseClient,
  lessonIds: string[],
): Promise<{
  closed: number;
  attendanceCreated: number;
  gradesCreated: number;
  skippedNoTeacher: number;
}> {
  if (lessonIds.length === 0) {
    return { closed: 0, attendanceCreated: 0, gradesCreated: 0, skippedNoTeacher: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: updated, error: updErr } = await db.from("lessons")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .in("id", lessonIds)
    .neq("status", "completed")
    .select("id");
  if (updErr) throw new Error(`completeLessons update: ${updErr.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualIds: string[] = (updated ?? []).map((r: any) => r.id);
  if (actualIds.length === 0) {
    return { closed: 0, attendanceCreated: 0, gradesCreated: 0, skippedNoTeacher: 0 };
  }

  const fillRes = await fillAttendanceAndGrades(admin, actualIds);
  return {
    closed: actualIds.length,
    attendanceCreated: fillRes.attCreated,
    gradesCreated: fillRes.gradesCreated,
    skippedNoTeacher: fillRes.skippedNoTeacher,
  };
}
