import { schoolViewContext } from "@/lib/school-view";
import { loadGroupsPage } from "@/lib/study-data";
import { GroupsView } from "@/app/admin/groups/GroupsView";

/** Группы школы глазами менеджера. Экран тот же, что у админа, не копия.
 *  Читаем служебным ключом с явным условием по школе; школа уезжает в формы. */
export const dynamic = "force-dynamic";

export default async function ManagerGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const { groups, catalog } = await loadGroupsPage(db, school.id);

  return (
    <GroupsView
      groups={groups as React.ComponentProps<typeof GroupsView>["groups"]}
      catalog={catalog as React.ComponentProps<typeof GroupsView>["catalog"]}
      schoolId={actor.role === "manager" ? school.id : undefined}
      // Цену задаёт менеджер: счёт выставляется по ней. Суперадмин заходит
      // сюда читать — школы ему не дают, значит и цену он не задаёт.
      canPrice={actor.role === "manager"}
    />
  );
}
