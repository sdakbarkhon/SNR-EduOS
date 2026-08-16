import { createClient } from "@/lib/supabase/server";
import { MarksView, type MarkRow } from "./MarksView";

/**
 * «Оценки и отметки» — экран администратора для правки запертых записей.
 *
 * ПОЧЕМУ ЗДЕСЬ, В АДМИНКЕ, ОТДЕЛЬНЫМ РАЗДЕЛОМ. Учительский кабинет устроен
 * вокруг УРОКА: чтобы дойти до оценки, нужно знать класс, предмет, дату и
 * открыть занятие. Администратор приходит с другой стороны — «родитель
 * жалуется на тройку у Иванова». Ему нужен поиск по ученику, а не навигация по
 * расписанию. Поэтому это простой список: строка = запись, фильтры сверху,
 * правка на месте. Копией учительского журнала он быть не должен.
 *
 * ЧТО В СПИСКЕ. Четыре вида записей, которые запирает миграция 203: оценки за
 * урок, посещаемость, оценки за домашние задания и за тесты. Отметки этапов не
 * показываются: они не самостоятельная оценка, а часть прохождения урока, и
 * искать их по ученику незачем.
 *
 * ПРАВА. Читаем пользовательским клиентом: правила базы сами сузят выдачу до
 * своей школы. Второй проверки в коде нет намеренно — одно правило, и оно в
 * базе (см. is_school_admin_of, миграция 203).
 */
export default async function AdminMarksPage() {
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = sb as any;

  const [{ data: grades }, { data: attendance }, { data: hw }, { data: tests }, { data: groups }] =
    await Promise.all([
      any.from("lesson_grades")
        .select("id, grade, comment, graded_at, student:students(full_name), lesson:lessons(starts_at, group:groups(id, name), subject:subjects(name))")
        .order("graded_at", { ascending: false }).limit(500),
      any.from("attendance")
        .select("id, status, marked_at, student:students(full_name), lesson:lessons(starts_at, group:groups(id, name), subject:subjects(name))")
        .order("marked_at", { ascending: false }).limit(500),
      any.from("homework_submissions")
        .select("id, grade, graded_at, student:students(full_name), homework:homework(title, group:groups(id, name), subject:subjects(name))")
        .not("graded_at", "is", null)
        .order("graded_at", { ascending: false }).limit(500),
      any.from("test_submissions")
        .select("id, score, max_score, grade, graded_at, student:students(full_name), homework:homework(title, group:groups(id, name), subject:subjects(name))")
        .not("graded_at", "is", null)
        .order("graded_at", { ascending: false }).limit(500),
      any.from("groups").select("id, name").order("name"),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: MarkRow[] = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((grades ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "lesson_grade" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.lesson?.group?.id ?? null,
      groupName: r.lesson?.group?.name ?? null,
      subject: r.lesson?.subject?.name ?? null,
      at: (r.graded_at ?? r.lesson?.starts_at) as string,
      value: r.grade == null ? "—" : String(r.grade),
      numeric: r.grade ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((attendance ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "attendance" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.lesson?.group?.id ?? null,
      groupName: r.lesson?.group?.name ?? null,
      subject: r.lesson?.subject?.name ?? null,
      at: (r.marked_at ?? r.lesson?.starts_at) as string,
      value: String(r.status),
      numeric: null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((hw ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "homework" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.homework?.group?.id ?? null,
      groupName: r.homework?.group?.name ?? null,
      subject: r.homework?.subject?.name ?? null,
      at: r.graded_at as string,
      value: r.grade == null ? "—" : String(r.grade),
      numeric: r.grade ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((tests ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "test" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.homework?.group?.id ?? null,
      groupName: r.homework?.group?.name ?? null,
      subject: r.homework?.subject?.name ?? null,
      at: r.graded_at as string,
      value: r.score == null ? "—" : `${r.score}${r.max_score != null ? ` / ${r.max_score}` : ""}`,
      numeric: r.score ?? null,
    })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  const subjects = [...new Set(rows.map((r) => r.subject).filter(Boolean))] as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupRows = ((groups ?? []) as any[]).map((g) => ({ id: g.id as string, name: g.name as string }));

  return <MarksView rows={rows} groups={groupRows} subjects={subjects.sort()} />;
}
