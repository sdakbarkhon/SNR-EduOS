"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStaff } from "@/lib/verify-staff";

export type MarkKind = "lesson_grade" | "attendance" | "homework" | "test";

const TABLE: Record<MarkKind, string> = {
  lesson_grade: "lesson_grades",
  attendance: "attendance",
  homework: "homework_submissions",
  test: "test_submissions",
};

/**
 * Правка одной записи админом школы или менеджером.
 *
 * ═══ 03.09.2026, СРЕЗ 3c — ПЕРЕВЕДЕНО НА СЛУЖЕБНЫЙ КЛЮЧ ══════════════════
 *
 * Это было ПОСЛЕДНЕЕ из сорока одного действия админки, писавшее под токеном
 * человека. Все сорок остальных ходят служебным ключом, и держать одно
 * исключение ради одного экрана дороже, чем привести его к общему виду.
 * Плюс менеджеру иначе не дать: правил доступа у него нет ни одного, а
 * заводить их запрещено.
 *
 * ЧТО ИМЕННО ПРОВЕРЯЛО ПРАВИЛО, И ЧЕМ ОНО ЗАМЕНЕНО. Политики «admin updates
 * …» из миграции 203 проверяли РОВНО ОДНО:
 *
 *     is_school_admin_of(school_id)
 *       = EXISTS(admins where user_id = auth.uid() and school_id = строка.school_id)
 *         OR is_super_admin()
 *
 * То есть «строка принадлежит моей школе». Больше ничего: ни диапазонов
 * значений, ни авторства, ни замка — всё это и раньше жило в коде.
 *
 * Заменено УСЛОВИЕМ В САМОМ ЗАПРОСЕ: .eq("school_id", staff.schoolId). Это
 * не «проверка рядом», а тот же самый предикат на том же самом месте — чужая
 * школа по-прежнему не находится, и наверх уходит тот же not_found. Лишнего
 * круга до базы не добавилось.
 *
 * Суперадмин при этом ничего не теряет: ветка is_super_admin() в правиле у
 * него и так перекрыта сужающим сторожем из миграции 222 (белый список пуст),
 * то есть писать сюда он не мог и вчера.
 *
 * ЗАМОК ОЦЕНОК НЕ ТРОНУТ. Автор записи (graded_by / marked_by) не меняется:
 * правка не переписывает историю. Отметка времени (graded_at / marked_at)
 * тоже — она нужна замку как точка отсчёта, и обновить её значило бы открыть
 * учителю новые пятнадцать минут.
 */
export async function updateMark(
  kind: MarkKind,
  id: string,
  value: number | string | null,
  /** Школа менеджера. Админ её не шлёт — его школа берётся из его строки. */
  requestedSchoolId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let staff;
  try {
    staff = await verifyStaff(requestedSchoolId);
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "unauthorized" };
  }
  const sb = createAdminClient();

  let patch: Record<string, unknown>;
  if (kind === "attendance") {
    const allowed = ["present", "absent_excused", "absent_unexcused"];
    if (typeof value !== "string" || !allowed.includes(value)) {
      return { ok: false, error: "bad_value" };
    }
    patch = { status: value };
  } else if (kind === "test") {
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      return { ok: false, error: "bad_value" };
    }
    patch = { score: value };
  } else {
    // Оценка за урок и за домашнее задание — школьная шкала 1..5.
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5)) {
      return { ok: false, error: "bad_value" };
    }
    patch = { grade: value };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from(TABLE[kind])
    .update(patch)
    .eq("id", id)
    // ВОТ ЧЕМ ЗАМЕНЕНО ПРАВИЛО ДОСТУПА. Ровно тот же предикат, что стоял в
    // is_school_admin_of: строка обязана принадлежать школе действующего.
    // Чужая не найдётся, и ниже вернётся not_found — как и раньше.
    .eq("school_id", staff.schoolId)
    .select("id");

  if (error) {
    console.error("[updateMark] правка не прошла:", error.message);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/marks");
  return { ok: true };
}
