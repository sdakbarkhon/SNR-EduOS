import type { Db } from "../supabase/factory";

/**
 * 11.08.2026 — ЕДИНСТВЕННОЕ место, где собирается путь файла в хранилище.
 *
 * ЗАЧЕМ. У бакетов не было способа понять, чей файл: у шести первый сегмент —
 * идентификатор учителя или ученика, у lesson-stage-images путь вообще
 * плоский, а у slide-images и h5p-content первый сегмент не значит ничего.
 * Из-за этого политики хранилища не могли проверить школу — и не проверяли:
 * пятьдесят политик, ни одного упоминания школы, семь бакетов открыты любому
 * вошедшему (замер 11.08; ученик настоящей школы скачал файл демо-школы).
 *
 * СОГЛАШЕНИЕ. Все новые файлы кладутся в папку с идентификатором школы:
 *
 *     <school_id>/<дальше как было раньше>
 *
 * На стороне базы это читают миграции 188 и 189: `fn_storage_path_visible`
 * решает, чей файл, а `fn_storage_rel` отрезает префикс, чтобы старые правила
 * «своей папки» продолжали считать сегменты по-прежнему.
 *
 * СТАРЫЕ ФАЙЛЫ НЕ ПЕРЕНОСИМ: путей без префикса 229, все они демо-школьные, и
 * их накрывает второе условие правила («префикса нет → это демо»).
 *
 * ВТОРОЙ КОПИИ БЫТЬ НЕ ДОЛЖНО. Любое место, которое кладёт файл в хранилище,
 * зовёт одну из этих двух функций. Собирать путь строкой на месте нельзя:
 * файл станет невидим и своему владельцу, и всем остальным.
 */

/** Путь с префиксом школы, когда идентификатор школы уже известен. */
export function schoolStoragePath(schoolId: string, ...segments: Array<string | number>): string {
  if (!schoolId) throw new Error("schoolStoragePath: не передан идентификатор школы");
  const tail = segments
    .map((s) => String(s).replace(/^\/+|\/+$/g, ""))
    .filter((s) => s.length > 0);
  if (tail.length === 0) throw new Error("schoolStoragePath: пустой путь");
  return [schoolId, ...tail].join("/");
}

/** Школа текущего пользователя. Отдельный вызов, а не догадка по данным:
 *  ту же функцию спрашивают правила видимости в базе. */
export async function myStorageSchoolId(db: Db): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("current_school_id");
  if (error || !data) {
    throw new Error("Не удалось определить школу для загрузки файла");
  }
  return data as string;
}

/** Путь с префиксом школы текущего пользователя — основной вариант для
 *  загрузок, идущих под сессией учителя или ученика. */
export async function mySchoolStoragePath(db: Db, ...segments: Array<string | number>): Promise<string> {
  return schoolStoragePath(await myStorageSchoolId(db), ...segments);
}
