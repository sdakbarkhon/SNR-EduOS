import type { PostgrestError } from "@supabase/supabase-js";

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
