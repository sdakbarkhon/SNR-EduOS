import type React from "react";
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
        // Миграция 232: личные сведения — колонками students, медицинские —
        // связанной таблицей student_medical. Правило доступа на неё пускает
        // админа своей школы и родителя ребёнка; учитель эту страницу не
        // открывает вовсе, а если бы открыл — вложение вернулось бы пустым.
        "id, user_id, full_name, username, google_email, balance, created_at, " +
          "birth_date, gender, phone, file_no, " +
          "student_medical(allergies, medical_notes), " +
          "student_groups(group_id, groups(id, name, subject))",
      )
      .order("full_name"),
    supabase.from("groups").select("id, name, subject").order("name"),
  ]);
  if (studentsError) console.error("[AdminStudentsPage] students query failed:", studentsError.message);
  if (groupsError) console.error("[AdminStudentsPage] groups query failed:", groupsError.message);

  return (
    <StudentsView
      // Через unknown: сгенерированный тип не описывает вложение
      // student_medical как связь один-к-одному, и supabase-js типизирует
      // весь ответ как ошибку строкой. Тот же приём, что в
      // packages/core/src/queries/parent.ts с алиасом куратора.
      students={(students ?? []) as unknown as React.ComponentProps<typeof StudentsView>["students"]}
      groups={groups ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
