import { createClient } from "@/lib/supabase/server";
import { StudentsView } from "./StudentsView";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  // google_email добавлена 20.08.2026. Без неё поле почты в форме правки
  // рисовалось пустым, а сохранение писало эту пустоту поверх настоящей почты —
  // то есть каждое «Сохранить» отвязывало ученику вход через Google. Колонки не
  // было ни в запросе, ни под тем именем, которое ждал компонент (StudentsView).
  //
  // Приведение к any — по той же причине, что на странице админов суперадмина
  // (superadmin/admins/page.tsx): в сгенерированном
  // packages/core/src/database.types.ts колонки google_email нет ни у одной
  // таблицы, файл не пересобирали с миграции 213. Без приведения компилятор
  // считает запрос ошибочным, хотя в базе колонка есть.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: students, error: studentsError }, { data: groups, error: groupsError }] = await Promise.all([
    sb
      .from("students")
      .select(
        "id, user_id, full_name, username, google_email, created_at, student_groups(group_id, groups(id, name, subject))",
      )
      .order("full_name"),
    supabase.from("groups").select("id, name, subject").order("name"),
  ]);
  if (studentsError) console.error("[AdminStudentsPage] students query failed:", studentsError.message);
  if (groupsError) console.error("[AdminStudentsPage] groups query failed:", groupsError.message);

  return (
    <StudentsView
      students={students ?? []}
      groups={groups ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
