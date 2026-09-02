import { schoolViewContext } from "@/lib/school-view";
import { loadTeachersPage } from "@/lib/people-data";
import { TeachersView } from "@/app/admin/teachers/TeachersView";

/** Учителя школы глазами менеджера. Экран тот же, что у админа; отличия —
 *  чтение служебным ключом с условием по школе и школа, уезжающая в формы.
 *  Разбор — в комментарии соседнего экрана учеников. */
export const dynamic = "force-dynamic";

export default async function ManagerTeachersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const { teachers, bindings, catalog, groups } = await loadTeachersPage(db, school.id);

  return (
    <TeachersView
      teachers={teachers as React.ComponentProps<typeof TeachersView>["teachers"]}
      bindings={bindings}
      catalog={catalog}
      groups={groups}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
