// Ночной крон (решение 21.07) — с отключённым авто-стартом/авто-финишем
// по времени (см. миграция 143) уроки прошедших дней, которые учитель не
// начал/не закончил вручную, никогда бы сами не перешли в 'completed'.
// Раз в сутки в 19:00 UTC (= 00:00 по Ташкенту, см. vercel.json) закрывает
// их одним UPDATE — по времени (ends_at), НЕ по статусу, только уроки СТРОГО
// прошедших дней (сегодняшние и будущие не трогает).
//
// Гейт: ends_at < начало сегодняшнего дня по Ташкенту (UTC+5) И status !=
// 'completed'. Идемпотентно по конструкции.
//
// ЧАСТЬ 4 (расширение): раньше побочные эффекты автозавершения (посещаемость
// + оценки за урок) проставляла fn_auto_end_lessons(), отключённая миграцией
// 143. Из-за этого у учеников не появлялись посещаемость и оценки. Теперь
// крон ДОПОЛНИТЕЛЬНО досоздаёт для НЕДАВНО прошедших уроков (окно ~3 дня):
//   - attendance: present≈90% / absent_unexcused≈8% / absent_excused≈2%;
//   - lesson_grades: ~35% ПРИСУТСТВОВАВШИХ, распределение 5≈30/4≈40/3≈25/2≈5.
// Всё кодом (без AI), идемпотентно (пропускает существующие (student,lesson)),
// school_id задаётся ЯВНО из данных (реф миграция 71), гейт по времени.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TZ_MS = 5 * 60 * 60 * 1000; // Ташкент, UTC+5 — фиксированное смещение, не системный часовой пояс
const RECENT_WINDOW_DAYS = 3; // насколько назад крон досоздаёт посещаемость/оценки

function startOfTodayTashkentUtcIso(): string {
  const nowUtc = new Date();
  const tashkentNow = new Date(nowUtc.getTime() + TZ_MS);
  const tashkentMidnightUtcMs =
    Date.UTC(tashkentNow.getUTCFullYear(), tashkentNow.getUTCMonth(), tashkentNow.getUTCDate()) - TZ_MS;
  return new Date(tashkentMidnightUtcMs).toISOString();
}

function pickAttStatus(r: number): "present" | "absent_unexcused" | "absent_excused" {
  if (r < 0.9) return "present";
  if (r < 0.98) return "absent_unexcused";
  return "absent_excused";
}
function pickGrade(r: number): number {
  if (r < 0.3) return 5;
  if (r < 0.7) return 4;
  if (r < 0.95) return 3;
  return 2;
}

/** Досоздаёт посещаемость + оценки за урок для набора уроков. Идемпотентно.
 *  Возвращает счётчики. db — service-role admin client. */
async function fillAttendanceAndGrades(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  lessons: Array<{ id: string; group_id: string }>,
): Promise<{ attCreated: number; gradesCreated: number; skippedNoTeacher: number }> {
  if (lessons.length === 0) return { attCreated: 0, gradesCreated: 0, skippedNoTeacher: 0 };
  const lessonIds = lessons.map((l) => l.id);
  const groupIds = [...new Set(lessons.map((l) => l.group_id))];

  // Ученики групп + школа ученика.
  const { data: sgRows, error: sgErr } = await db
    .from("student_groups").select("group_id, student_id").in("group_id", groupIds);
  if (sgErr) throw new Error(`student_groups: ${sgErr.message}`);
  const { data: studentRows, error: stErr } = await db
    .from("students").select("id, school_id").in("id", [...new Set((sgRows ?? []).map((r: any) => r.student_id))]);
  if (stErr) throw new Error(`students: ${stErr.message}`);
  const schoolByStudent = new Map<string, string>((studentRows ?? []).map((s: any) => [s.id, s.school_id]));
  const studentsByGroup = new Map<string, string[]>();
  for (const r of sgRows ?? []) {
    if (!studentsByGroup.has(r.group_id)) studentsByGroup.set(r.group_id, []);
    studentsByGroup.get(r.group_id)!.push(r.student_id);
  }

  // Учитель группы (graded_by для lesson_grades — NOT NULL).
  const { data: groupRows, error: gErr } = await db
    .from("groups").select("id, teacher_id").in("id", groupIds);
  if (gErr) throw new Error(`groups: ${gErr.message}`);
  const teacherByGroup = new Map<string, string | null>((groupRows ?? []).map((g: any) => [g.id, g.teacher_id]));

  // Существующие attendance/оценки — для идемпотентности.
  const { data: existAtt, error: aErr } = await db
    .from("attendance").select("lesson_id, student_id, status").in("lesson_id", lessonIds);
  if (aErr) throw new Error(`attendance read: ${aErr.message}`);
  const attByLesson = new Map<string, Map<string, string>>(); // lesson -> (student -> status)
  for (const r of existAtt ?? []) {
    if (!attByLesson.has(r.lesson_id)) attByLesson.set(r.lesson_id, new Map());
    attByLesson.get(r.lesson_id)!.set(r.student_id, r.status);
  }
  const { data: existLg, error: lgErr } = await db
    .from("lesson_grades").select("lesson_id, student_id").in("lesson_id", lessonIds);
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
      gradeRows.push({ lesson_id: lesson.id, student_id: sid, grade: pickGrade(Math.random()), graded_by: teacherId, school_id: school });
    }
  }

  let attCreated = 0;
  for (let i = 0; i < attRows.length; i += 500) {
    const batch = attRows.slice(i, i + 500);
    const { error } = await db.from("attendance").upsert(batch, { onConflict: "student_id,lesson_id", ignoreDuplicates: true });
    if (error) throw new Error(`attendance insert: ${error.message}`);
    attCreated += batch.length;
  }
  let gradesCreated = 0;
  for (let i = 0; i < gradeRows.length; i += 500) {
    const batch = gradeRows.slice(i, i + 500);
    const { error } = await db.from("lesson_grades").upsert(batch, { onConflict: "lesson_id,student_id", ignoreDuplicates: true });
    if (error) throw new Error(`lesson_grades insert: ${error.message}`);
    gradesCreated += batch.length;
  }
  return { attCreated, gradesCreated, skippedNoTeacher };
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = startOfTodayTashkentUtcIso();

  // 1. Закрыть статусы прошедших уроков (как раньше).
  const { data, error } = await db
    .from("lessons")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .lt("ends_at", cutoff)
    .neq("status", "completed")
    .select("id");

  if (error) {
    console.error("[close-past-lessons] update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const closed = data?.length ?? 0;

  // 2. Досоздать посещаемость + оценки за недавно прошедшие уроки (окно ~3 дня,
  //    гейт по времени). Не только по только что закрытым — покрываем и уроки,
  //    закрытые вручную учителем, у которых данных нет. Идемпотентно.
  const recentFrom = new Date(new Date(cutoff).getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let attCreated = 0, gradesCreated = 0, skippedNoTeacher = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recent, error: recentErr } = await (db as any)
      .from("lessons").select("id, group_id").lt("ends_at", cutoff).gte("ends_at", recentFrom);
    if (recentErr) throw new Error(`recent lessons: ${recentErr.message}`);
    const res = await fillAttendanceAndGrades(db, (recent ?? []) as Array<{ id: string; group_id: string }>);
    attCreated = res.attCreated; gradesCreated = res.gradesCreated; skippedNoTeacher = res.skippedNoTeacher;
  } catch (e) {
    // Не роняем весь крон, если побочная генерация упала — статусы уже закрыты.
    console.error("[close-past-lessons] attendance/grades fill failed:", (e as Error)?.message ?? e);
  }

  console.log(`[close-past-lessons] cutoff=${cutoff} closed=${closed} attendance+=${attCreated} grades+=${gradesCreated} skippedNoTeacher=${skippedNoTeacher}`);
  return NextResponse.json({ cutoff, closed, attendanceCreated: attCreated, gradesCreated, skippedNoTeacher });
}
