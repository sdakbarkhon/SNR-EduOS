"use server";

import { revalidatePath } from "next/cache";
import { guard } from "@/lib/action-result";
import { verifyStaff } from "@/lib/verify-staff";
import { readCardFields } from "@/lib/school-card";
import { updateSchoolCard } from "@/lib/admin-api";
import { withJournal } from "@/lib/superadmin-journal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ПРАВКА КАРТОЧКИ ШКОЛЫ МЕНЕДЖЕРОМ. Заход 3, первый сквозной случай.
 *
 * ═══ ПОЧЕМУ ИМЕННО КАРТОЧКА ═══════════════════════════════════════════════
 *
 * Это единственное разрешённое менеджеру действие, которому НЕ нужен
 * переезд шестнадцати админских экранов: карточка живёт в самой строке школы,
 * а школа приходит из адреса. Значит на ней можно доказать всю связку —
 * проверку роли, школу из адреса, отказ на подделку и запись в журнал — не
 * трогая ни одного экрана админа.
 *
 * ═══ ЧТО ИМЕННО РАЗРЕШЕНО ═════════════════════════════════════════════════
 *
 * Ровно шесть полей: адрес, телефон, почта, директор, сайт, реквизиты. Их
 * список — SCHOOL_CARD_FIELDS из lib/form-patch.ts, и readCardFields берёт
 * ТОЛЬКО их.
 *
 * Название, код, автостарт уроков и длительность урока сюда не попадают
 * ФИЗИЧЕСКИ, а не по договорённости: этот код их не читает вовсе. Даже если
 * форму подделать и прислать `name`, он до записи не доедет.
 *
 * Логотип тоже не трогаем: у суперадмина он правится тем же окном, что имя и
 * код, а менеджеру имя и код запрещены. Разбирать логотип отдельно — работа,
 * которую заказчик не просил.
 *
 * ═══ ШКОЛА ИЗ АДРЕСА, И ЕЁ ПРОВЕРЯЮТ ══════════════════════════════════════
 *
 * verifyStaff отвергает несуществующую школу и демо-школу, а админа школы,
 * назвавшего чужую, — с отказом WRONG_SCHOOL. Подделать здесь нечего:
 * менеджеру и так разрешены все школы, а всем остальным — ни одной.
 */
export async function actionManagerUpdateSchoolCard(
  schoolId: string,
  formData: FormData,
) {
  return guard(async () => {
    const staff = await verifyStaff(schoolId);
    // Карточку чужой школы правит только менеджер: у админа для своей есть
    // свой путь, и заводить ему второй незачем.
    if (staff.role !== "manager") throw new Error("Not manager");

    const поля = readCardFields(formData);
    if (Object.keys(поля).length === 0) return;

    // Имя школы для журнала: после правки оно не меняется, но искать человек
    // будет именно по нему.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: школа } = await (createAdminClient() as any)
      .from("schools").select("name").eq("id", staff.schoolId).maybeSingle();

    await withJournal(
      {
        action: "school.update",
        actorRole: "manager",
        actorUserId: staff.userId,
        actorName: null,
        targetType: "school",
        targetId: staff.schoolId,
        targetName: (школа as { name?: string } | null)?.name ?? null,
        // В журнал уходят ИМЕНА изменённых полей, а не их значения: реквизиты
        // и телефон директора там не нужны, а какие поля трогали — нужно.
        details: { cardFields: Object.keys(поля) },
      },
      () => updateSchoolCard(staff.schoolId, поля),
    );

    revalidatePath(`/manager/schools/${staff.schoolId}/view/card`);
    revalidatePath(`/manager/schools/${staff.schoolId}/view`);
    revalidatePath("/admin/profile");
    revalidatePath("/superadmin/schools");
  });
}
