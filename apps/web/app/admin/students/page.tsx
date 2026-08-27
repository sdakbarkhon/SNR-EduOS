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
  // то есть каждое «Сохранить» отвязывало ученику вход через Google.
  //
  // 22.08.2026 — приведение к any отсюда убрано: типы пересобраны из живой
  // базы, колонка в них есть, и запрос проверяется компилятором как обычный.
  const [{ data: students, error: studentsError }, { data: groups, error: groupsError }] = await Promise.all([
    supabase
      .from("students")
      .select(
        // balance — заход 3 по платежам: админ видит баланс ребёнка и
        // пополняет его рукой, пока платёжной системы нет.
        "id, user_id, full_name, username, google_email, balance, created_at, student_groups(group_id, groups(id, name, subject))",
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
