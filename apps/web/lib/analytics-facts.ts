// Server-side only. Сбор фактов для аналитики: оценки, посещаемость, сдачи,
// просрочки.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Сбор жил внутри страницы админской аналитики. Теперь
// те же факты нужны ИИ — и чтобы разобрать положение дел в школе, и чтобы
// подстроить урок под группу. Скопируй сбор во второе место, и через месяц
// экран будет показывать одно, а ИИ рассуждать о другом; спорить с таким
// расхождением невозможно, потому что оба «правы».
//
// СЧИТАЕТ ПО-ПРЕЖНЕМУ ОБЩИЙ СЛОЙ. Здесь только выборка строк и приведение их
// к плоскому виду. Все формулы — средний балл, посещаемость, признаки риска,
// динамика — живут в @snr/core (presenters/analytics.ts) и здесь не
// повторяются ни одной строкой.
//
// ЧИТАЕТ ПОД СЕССИЕЙ ВЫЗЫВАЮЩЕГО — ЕСЛИ ШКОЛА НЕ ЗАДАНА ЯВНО. У админа
// школы правила доступа сами отсекают чужое, и это единственная защита, на
// которую тут можно полагаться.
//
// 30.08.2026 — ПОЯВИЛСЯ ПАРАМЕТР schoolId, И ОН ОБЯЗАТЕЛЕН ДЛЯ СУПЕРАДМИНА.
// Суперадмин ходит служебным ключом, личности в базе у него нет, поэтому
// current_school_id() для него пуст, а `OR is_super_admin()` в правилах ни к
// какой школе не привязан. Любой запрос отсюда без явного фильтра посчитал
// бы ОБЕ школы разом и показал бы смесь как данные одной. Когда schoolId
// задан, КАЖДЫЙ запрос несёт .eq("school_id", …) — ровно как это делают все
// десять экранов просмотра школы (см. lib/school-view.ts).

import { getStudentGrades, getSubjectKeyByLabel } from "@snr/core";
import type { AnalyticsInput } from "@snr/core";

export type AnalyticsFactsBase = AnalyticsInput & {
  students: Array<{ id: string; name: string; groupName: string; groupId: string }>;
  /** «Сегодня» школы — от него считаются периоды и просрочка. */
  todayIso: string;
};

/**
 * Собирает факты школы целиком.
 *
 * `todayIso` — школьное «сегодня», а не реальная дата: демо-школа заморожена,
 * и просрочку надо считать от её собственной даты, иначе все задания разом
 * окажутся просроченными, чего в её мире не случилось.
 */
export async function collectAnalyticsFacts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  todayIso: string,
  /** Школа, о которой считаем. Обязателен для служебного клиента: без него
   *  запросы соберут обе школы разом. Админу школы не нужен — за него
   *  сужают правила доступа. */
  schoolId?: string,
): Promise<AnalyticsFactsBase> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const школа = <T>(q: T): T => (schoolId ? (q as any).eq("school_id", schoolId) : q);

  const [gradesRaw, studentsRes, attendanceRes, homeworkRes, submissionsRes] = await Promise.all([
    // Оценки — тем же сбором, что и экран оценок ученика: шесть источников,
    // одна нормировка к пятибалльной. Своего запроса аналитика не заводит.
    //
    // 30.08.2026 — .catch(() => []) СНЯТ. Он превращал сбой выборки в пустой
    // список, а экран показывал нули как настоящие данные: «средний балл 0,
    // оценок 0» неотличимо от школы, где оценок правда нет. Пусть падает —
    // страница покажет ошибку, и это честнее молчаливого нуля.
    getStudentGrades(db, undefined, schoolId ? { schoolId } : undefined),
    школа(db.from("students").select("id, full_name, student_groups(groups(id, name))")),
    школа(db.from("attendance").select("student_id, status, lesson:lessons!inner(starts_at, group:groups!inner(name), subject:subjects(name))")),
    школа(db.from("homework").select("id, due_date, group_id, group:groups!inner(name), subject:subjects(name)")),
    школа(db.from("homework_submissions").select("id, student_id, homework_id, submitted_at")),
  ]);

  type StudentRow = {
    id: string; full_name: string;
    student_groups: Array<{ groups: { id: string; name: string } | null }>;
  };
  const studentRows = ((studentsRes.data ?? []) as StudentRow[]);

  const students = studentRows.map((s) => ({
    id: s.id,
    name: s.full_name,
    groupName: s.student_groups?.[0]?.groups?.name ?? "",
    groupId: s.student_groups?.[0]?.groups?.id ?? "",
  }));

  // Посещаемость. Уважительный и неуважительный пропуск одинаково считаются
  // отсутствием: вопрос здесь «был ли ученик на уроке», а не «виноват ли».
  //
  // ПРЕДМЕТ ПРИВОДИТСЯ К ТОМУ ЖЕ КЛЮЧУ, ЧТО И У ОЦЕНОК. Сбор оценок резолвит
  // предмет через getSubjectKeyByLabel («Русский язык» → russian), а в записи
  // посещаемости лежит название как есть. Без приведения таблица предметов
  // распадается надвое: строки со средним баллом без посещаемости и наоборот.
  type AttRow = {
    student_id: string; status: string;
    lesson: { starts_at: string; group: { name: string } | null; subject: { name: string } | null } | null;
  };
  const attendance = ((attendanceRes.data ?? []) as AttRow[]).map((a) => ({
    studentId: a.student_id,
    groupName: a.lesson?.group?.name ?? "",
    subject: getSubjectKeyByLabel(a.lesson?.subject?.name) ?? "",
    date: a.lesson?.starts_at ?? "",
    present: a.status === "present",
  })).filter((a) => a.date);

  // Сдано и просрочено.
  //
  // СДАНО — это строки сдач, тут считать нечего.
  //
  // ПРОСРОЧЕНО — то, чего НЕТ: задание, срок которого прошёл, а сдачи от
  // ученика нет. Такую запись негде взять запросом, её приходится собирать:
  // для каждого задания с истёкшим сроком берём учеников его группы и
  // вычитаем тех, кто сдал.
  type HwRow = { id: string; due_date: string | null; group_id: string; group: { name: string } | null; subject: { name: string } | null };
  type SubRow = { id: string; student_id: string; homework_id: string; submitted_at: string | null };
  const homework = (homeworkRes.data ?? []) as HwRow[];
  const submissions = (submissionsRes.data ?? []) as SubRow[];

  const hwById = new Map(homework.map((h) => [h.id, h]));
  const submitted = submissions.map((s) => {
    const h = hwById.get(s.homework_id);
    return {
      studentId: s.student_id,
      groupName: h?.group?.name ?? "",
      subject: getSubjectKeyByLabel(h?.subject?.name) ?? "",
      date: s.submitted_at ?? "",
    };
  }).filter((s) => s.date);

  const submittedKey = new Set(submissions.map((s) => `${s.student_id}:${s.homework_id}`));
  const studentsOfGroup = new Map<string, string[]>();
  for (const s of studentRows) {
    for (const sg of s.student_groups ?? []) {
      const gid = sg.groups?.id;
      if (!gid) continue;
      const cur = studentsOfGroup.get(gid);
      if (cur) cur.push(s.id); else studentsOfGroup.set(gid, [s.id]);
    }
  }

  const overdue: AnalyticsInput["overdue"] = [];
  for (const h of homework) {
    const due = h.due_date?.slice(0, 10);
    if (!due || due >= todayIso) continue; // срок не прошёл — не просрочка
    for (const studentId of studentsOfGroup.get(h.group_id) ?? []) {
      if (submittedKey.has(`${studentId}:${h.id}`)) continue;
      overdue.push({
        studentId,
        groupName: h.group?.name ?? "",
        subject: getSubjectKeyByLabel(h.subject?.name) ?? "",
        date: due,
      });
    }
  }

  return {
    // sourceTable ПЕРЕДАЁТСЯ ДАЛЬШЕ. 30.08.2026: здесь строка сворачивалась
    // без него, и правило среднего балла нечем было применить — в среднее
    // подмешивались оценки за этапы урока. У администратора выходило 4.37
    // против 4.38 по общему правилу.
    grades: gradesRaw.map((g) => ({
      studentId: g.studentId,
      groupName: g.groupName,
      subject: g.subject,
      date: g.date,
      grade5: g.grade5,
      title: g.title,
      sourceTable: g.sourceTable,
    })).filter((g) => g.date && g.studentId),
    attendance,
    submitted,
    overdue,
    students,
    todayIso,
  };
}
