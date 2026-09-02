import { schoolViewContext } from "@/lib/school-view";
import { loadMarksPage } from "@/lib/study-data";
import { MarksView } from "@/app/admin/marks/MarksView";

/** Оценки школы глазами менеджера — он их и правит.
 *
 *  updateMark переведена на служебный ключ (срез 3c), и школа строки
 *  проверяется условием в самом запросе — тем же предикатом, что стоял в
 *  правиле доступа. */
export const dynamic = "force-dynamic";

export default async function ManagerMarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const { rows, groups, subjects } = await loadMarksPage(db, school.id);

  return (
    <MarksView
      rows={rows}
      groups={groups}
      subjects={subjects}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
