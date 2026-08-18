import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentGrades, getSubjectKeyByLabel } from "@snr/core";
import { getMySchoolNow } from "@/lib/school-time-server";
import { AnalyticsView, type AnalyticsFacts } from "./AnalyticsView";

// Общая аналитика школы для администратора.
//
// ЧТО ВАЖНО ПРО ДОСТУП. Все запросы идут ПОД СЕССИЕЙ АДМИНА, а не служебным
// ключом. Это не мелочь: правила доступа сами отсекают чужие школы, и админ
// физически не может увидеть чужие оценки — проверка не в коде экрана, а в
// базе. Служебный ключ отдал бы всё подряд, и любая ошибка в фильтре стала бы
// утечкой между школами.
//
// ПОЧЕМУ ФАКТЫ, А НЕ ГОТОВЫЕ ЧИСЛА. Экран считает сам, в браузере: фильтры
// (период, группа, предмет) и выгрузка должны работать мгновенно и вместе, а
// сводить в SQL пришлось бы отдельным запросом на каждое сочетание. Объём это
// позволяет: в демо-школе около 1200 оценок и 580 отметок посещаемости на
// 30 учеников. Если школа вырастет до десятков тысяч записей, сводить придётся
// на сервере — и это единственное место, которое тогда меняется.

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Роль уже проверил app/admin/layout.tsx — сюда без записи в admins не
  // попасть. Школа берётся оттуда же, чтобы список учеников совпадал с тем,
  // что видит остальная админка.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const { data: admin } = await anyDb.from("admins").select("school_id").eq("user_id", user.id).maybeSingle();
  const schoolId = (admin as { school_id: string } | null)?.school_id ?? null;

  // «Сегодня» школы, а не реальные часы: демо-школа заморожена, и просрочку
  // надо считать от её собственной даты — иначе все задания разом окажутся
  // просроченными, чего в её мире не случилось.
  const schoolNow = await getMySchoolNow(db);
  const todayIso = schoolNow.toISOString().slice(0, 10);

  const [gradesRaw, studentsRes, attendanceRes, homeworkRes, submissionsRes] = await Promise.all([
    // Оценки — тем же сбором, что и экран оценок ученика: шесть источников,
    // одна нормировка к пятибалльной. Своего запроса аналитика не заводит.
    getStudentGrades(db).catch(() => []),
    anyDb.from("students").select("id, full_name, status, student_groups(groups(id, name))"),
    anyDb.from("attendance").select("student_id, status, lesson:lessons!inner(starts_at, group:groups!inner(name), subject:subjects(name))"),
    anyDb.from("homework").select("id, due_date, group_id, group:groups!inner(name), subject:subjects(name)"),
    anyDb.from("homework_submissions").select("id, student_id, homework_id, submitted_at"),
  ]);

  type StudentRow = {
    id: string; full_name: string; status: string | null;
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
  type AttRow = {
    student_id: string; status: string;
    lesson: { starts_at: string; group: { name: string } | null; subject: { name: string } | null } | null;
  };
  //
  // ПРЕДМЕТ ПРИВОДИТСЯ К ТОМУ ЖЕ КЛЮЧУ, ЧТО И У ОЦЕНОК. Сбор оценок резолвит
  // предмет через getSubjectKeyByLabel («Русский язык» → russian), а в записи
  // посещаемости лежит название как есть. Без приведения таблица предметов
  // распадалась надвое: строки со средним баллом и без посещаемости, и строки
  // с посещаемостью без балла — проверено на демо-школе, было 5 слагов и 3
  // названия отдельными строками. Резолвер тот же самый, второго не заводим.
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
  // вычитаем тех, кто сдал. Отсюда и список групп по ученикам выше.
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

  const overdue: AnalyticsFacts["overdue"] = [];
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

  const facts: AnalyticsFacts = {
    grades: gradesRaw.map((g) => ({
      studentId: g.studentId,
      groupName: g.groupName,
      subject: g.subject,
      date: g.date,
      grade5: g.grade5,
    })).filter((g) => g.date && g.studentId),
    attendance,
    submitted,
    overdue,
    students,
    todayIso,
    hasSchool: Boolean(schoolId),
  };

  return <AnalyticsView facts={facts} />;
}
