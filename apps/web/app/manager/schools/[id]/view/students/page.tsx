import type React from "react";
import { schoolViewContext } from "@/lib/school-view";
import { loadStudentsPage } from "@/lib/people-data";
import { StudentsView } from "@/app/admin/students/StudentsView";

/**
 * Ученики школы глазами менеджера. Срез 3b — он их и правит.
 *
 * ЭКРАН ТОТ ЖЕ, ЧТО У АДМИНА: StudentsView взят как есть, а не скопирован.
 * Отличий два, и оба необязательные свойства:
 *   * читаем служебным ключом с ЯВНЫМ условием по школе — у менеджера правил
 *     доступа к школьным данным нет ни одного, и заводить их запрещено;
 *   * школа передаётся вниз, чтобы каждая форма несла её с собой.
 *
 * Проверка и школа — тем же schoolViewContext, что у десяти экранов
 * просмотра: он же отсекает демо-школу и чужого. Второй копии правила нет.
 */
export const dynamic = "force-dynamic";

export default async function ManagerStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const { students, groups } = await loadStudentsPage(db, school.id);

  return (
    <StudentsView
      students={students as unknown as React.ComponentProps<typeof StudentsView>["students"]}
      groups={groups as Array<{ id: string; name: string; subject: string }>}
      // Суперадмин сюда тоже заходит — на чтение. Школы ему не даём: без неё
      // формы уйдут без school_id, а verifyStaff его и не пустит.
      schoolId={actor.role === "manager" ? school.id : undefined}
      // Пополнение баланса — деньги, и оно у менеджера. Суперадмин заходит
      // сюда читать, и школы ему не дают, — значит и кошелька он не увидит.
      canMoney={actor.role === "manager"}
    />
  );
}
