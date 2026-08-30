import { createClient } from "@/lib/supabase/server";
import { GroupsView } from "./GroupsView";

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  // Z.2.2: справочник школы вместо захардкоженного списка предметов в форме.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = supabase as any;
  const [
    { data: groups, error: groupsError },
    { data: catalog, error: catalogError },
  ] = await Promise.all([
    supabase
      .from("groups")
      .select(
        // 30.08.2026 — связь teachers!groups_teacher_id_fkey из выборки
        // убрана вместе с колонкой «Куратор» в таблице и полем в форме.
        // Заодно ушла и причина её именовать: между groups и teachers два
        // пути (прямой teacher_id и через group_teachers), PostgREST
        // отказывался угадывать и валил ВЕСЬ запрос ошибкой PGRST201.
        //
        // teacher_id оставлен в выборке: колонка в схеме есть (её не
        // удаляли), и тип строки в GroupsView её ждёт.
        //
        // course_price — заход 2 по платежам: колонка была в базе с самого
        // начала, но её не выбирал и не правил ни один экран.
        "id, name, subject, teacher_id, course_price, student_groups(student_id)",
      )
      .order("name"),
    sbAny.from("school_subjects").select("id, name, is_active").order("name"),
  ]);
  if (groupsError) console.error("[AdminGroupsPage] groups query failed:", groupsError.message);
  if (catalogError) console.error("[AdminGroupsPage] catalog query failed:", catalogError.message);

  return (
    <GroupsView
      groups={groups ?? []}
      catalog={catalog ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
