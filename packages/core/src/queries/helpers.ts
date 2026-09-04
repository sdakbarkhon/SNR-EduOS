import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Что выбирать у книги. 04.09.2026.
 *
 * Кроме собственных колонок — строка справочника школы по `books.catalog_id`
 * (миграция 254). Она нужна КАЖДОМУ экрану книг: подпись, значок и цвет
 * предмета идут через resolveSubject, а он спрашивает справочник первым.
 *
 * Строка лежит здесь, а не в трёх выборках, ровно по той же причине, по
 * которой резолвер один: разойдутся — и одна полка начнёт показывать
 * школьное название, а вторая словарное.
 */
export const BOOK_SELECT = "*, catalog:school_subjects(name, icon, color)";


/** Разворачивает ответ Postgrest: бросает при ошибке, иначе возвращает data. */
export function unwrap<T>(res: {
  data: T | null;
  error: PostgrestError | null;
}): T {
  if (res.error) throw res.error;
  if (res.data === null) {
    throw new Error("Supabase: пустой ответ (data = null)");
  }
  return res.data;
}
