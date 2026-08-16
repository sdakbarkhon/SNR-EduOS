"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MarkKind = "lesson_grade" | "attendance" | "homework" | "test";

const TABLE: Record<MarkKind, string> = {
  lesson_grade: "lesson_grades",
  attendance: "attendance",
  homework: "homework_submissions",
  test: "test_submissions",
};

/**
 * Правка одной записи администратором.
 *
 * Здесь НЕТ проверки «а моя ли это школа» — и это осознанно. Пишем обычным
 * пользовательским клиентом, а не сервисным ключом, поэтому запрос проходит
 * через правила базы: политики «admin updates …» из миграции 203 разрешают
 * запись только при is_school_admin_of(school_id). Чужая школа просто не
 * найдётся, и вернётся notFound. Одно правило в одном месте надёжнее двух.
 *
 * Автор записи (graded_by / marked_by) НЕ меняется: правка администратором не
 * переписывает историю — оценку по-прежнему поставил тот учитель.
 * Отметку времени (graded_at / marked_at) тоже не трогаем: она нужна замку как
 * точка отсчёта, и обновить её значило бы открыть учителю новые 15 минут.
 */
export async function updateMark(
  kind: MarkKind,
  id: string,
  value: number | string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

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
    .select("id");

  if (error) {
    console.error("[updateMark] правка не прошла:", error.message);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/marks");
  return { ok: true };
}
