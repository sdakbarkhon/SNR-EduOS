import type React from "react";
import { createClient } from "@/lib/supabase/server";
import { loadStudentsPage } from "@/lib/people-data";
import { StudentsView } from "./StudentsView";

/**
 * 03.09.2026, срез 3b — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/people-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Копия разошлась бы с оригиналом на первой правке.
 *
 * ШКОЛА ЗДЕСЬ НЕ ПЕРЕДАЁТСЯ, и это принципиально: без неё условие по школе не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила доступа. Ни одного лишнего условия у него не появилось.
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();
  const { students, groups } = await loadStudentsPage(supabase);

  return (
    <StudentsView
      // Через unknown: сгенерированный тип не описывает вложение
      // student_medical как связь один-к-одному, и supabase-js типизирует
      // весь ответ как ошибку строкой.
      students={students as unknown as React.ComponentProps<typeof StudentsView>["students"]}
      groups={groups as Array<{ id: string; name: string; subject: string }>}
      defaultOpenAdd={action === "add"}
    />
  );
}
