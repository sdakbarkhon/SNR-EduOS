import { createClient } from "@/lib/supabase/server";
import { isDemoSchool as resolveIsDemoSchool } from "@/lib/admin-api";
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

  // Z.2.6 — куратор группы есть только в демо-школе (решение заказчика 6.1).
  // В реальных школах поля в форме нет; ПРАВА куратора при этом не меняются —
  // их разделение отложено в Z.4, потому что is_curator_teacher() не знает
  // про школу и входит в SELECT-политику уроков.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await sbAny.from("admins").select("school_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  // Признак демо-школы — из schools.is_demo (служебным клиентом внутри
  // resolveIsDemoSchool), а не сравнением с вписанным идентификатором.
  const isDemoSchool = admin?.school_id ? await resolveIsDemoSchool(admin.school_id) : false;

  return (
    <GroupsView
      groups={groups ?? []}
      teachers={teachers ?? []}
      catalog={catalog ?? []}
      showCurator={isDemoSchool}
      defaultOpenAdd={action === "add"}
    />
  );
}
