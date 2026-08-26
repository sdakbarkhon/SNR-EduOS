import { joinSubjectNames } from "@snr/core";
import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

export default async function SchoolGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  // 26.08.2026: в колонке «Предмет» стоял groups.subject — сырой слаг
  // 'programming' латиницей у пяти групп из семи. Настоящие предметы группы
  // лежат в subjects; заглушки каталога (is_stub) отсеиваются.
  const [{ data: groups }, { data: teachers }, { data: links }, { data: subjects }] = await Promise.all([
    db.from("groups").select("id, name, subject, teacher_id, schedule_days").eq("school_id", school.id).order("name"),
    db.from("teachers").select("id, full_name").eq("school_id", school.id),
    db.from("student_groups").select("group_id, student_id").eq("school_id", school.id),
    db.from("subjects").select("group_id, name, is_stub, is_active").eq("school_id", school.id).order("name"),
  ]);

  const предметы = new Map<string, string[]>();
  for (const s of (subjects ?? []) as Array<{ group_id: string; name: string; is_stub: boolean | null; is_active: boolean | null }>) {
    if (s.is_stub === true || s.is_active === false) continue;
    const list = предметы.get(s.group_id);
    if (list) list.push(s.name); else предметы.set(s.group_id, [s.name]);
  }

  const имя = new Map<string, string>((teachers ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name] as const));
  const счёт = new Map<string, number>();
  for (const l of (links ?? []) as Array<{ group_id: string }>) {
    счёт.set(l.group_id, (счёт.get(l.group_id) ?? 0) + 1);
  }

  const rows = (groups ?? []).map((g: {
    id: string; name: string; subject: string | null; teacher_id: string | null;
    schedule_days: string[] | null;
  }) => ({
    id: g.id,
    name: g.name,
    // Шаблон хвоста тут без слов: страница отрисована на сервере, языка
    // читающего она не знает, а «+2» понятно на всех трёх.
    subject: joinSubjectNames(предметы.get(g.id) ?? [], "+{n}"),
    teacher: g.teacher_id ? имя.get(g.teacher_id) ?? null : null,
    students: счёт.get(g.id) ?? 0,
    days: Array.isArray(g.schedule_days) ? g.schedule_days.join(", ") : null,
  }));

  return (
    <TableClient
      titleKey="svTabGroups"
      columns={[
        { key: "name", labelKey: "svColName" },
        { key: "subject", labelKey: "svColSubject" },
        { key: "teacher", labelKey: "svColTeacher" },
        { key: "students", labelKey: "svColStudents", right: true, narrow: true },
        { key: "days", labelKey: "svColDays" },
      ]}
      rows={rows}
    />
  );
}
