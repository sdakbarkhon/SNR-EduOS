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
    { data: teachers, error: teachersError },
    { data: catalog, error: catalogError },
  ] = await Promise.all([
    supabase
      .from("groups")
      .select(
        // teachers! с именем связи — обязательно. Между groups и teachers ДВА
        // пути: прямой groups.teacher_id и через таблицу group_teachers.
        // PostgREST отказывается угадывать и валит ВЕСЬ запрос ошибкой
        // PGRST201, а страница показывает «Групп пока нет» — потому что
        // groups приходит null и превращается в пустой массив ниже.
        // course_price — заход 2 по платежам: колонка была в базе с самого
        // начала, но её не выбирал и не правил ни один экран.
        "id, name, subject, teacher_id, course_price, teachers!groups_teacher_id_fkey(id, full_name), student_groups(student_id)",
      )
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    sbAny.from("school_subjects").select("id, name, is_active").order("name"),
  ]);
  if (groupsError) console.error("[AdminGroupsPage] groups query failed:", groupsError.message);
  if (teachersError) console.error("[AdminGroupsPage] teachers query failed:", teachersError.message);
  if (catalogError) console.error("[AdminGroupsPage] catalog query failed:", catalogError.message);

  // 28.08.2026 — КУРАТОР ОТКРЫТ ОБЕИМ ШКОЛАМ.
  //
  // Здесь стояло сужение до демо-школы (Z.2.6, решение заказчика 6.1) с
  // оговоркой: разделение ПРАВ куратора отложено, потому что
  // is_curator_teacher() не знала про школу. Она узнала — миграция 187
  // добавила в неё условие s.is_demo, и особые права куратора и без того не
  // выходят за пределы демо-школы.
  //
  // Заказчик решил 28.08.2026: куратор задаётся у группы, один на класс, в
  // обеих школах. Признак демо-школы этому экрану больше не нужен.

  return (
    <GroupsView
      groups={groups ?? []}
      teachers={teachers ?? []}
      catalog={catalog ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
