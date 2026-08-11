// K.1, 05.08.2026 — загрузка .mp4-файлов в общий bucket lesson-videos
// (миграция 167) + резолв storagePath → signed URL. Используется всеми 4
// местами, где учитель может прикрепить видео файлом вместо ссылки:
// lesson_materials, teacher_library_materials, homework.attachment.
// course_materials — не сюда (там нет отдельного бакета, см. resheniya_2.md).
import type { SupabaseClient } from "@supabase/supabase-js";
import { mySchoolStoragePath } from "@snr/core";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB — дефолтный лимит бакета lesson-videos, не поднимаем

export type VideoFileError = "type" | "size" | null;

/** Расширение .mp4 (без учёта регистра) + MIME video/mp4 (пусто допускаем —
 *  некоторые ОС/браузеры не проставляют MIME для .mp4). Размер ≤ 50MB. */
export function validateVideoFile(file: File): VideoFileError {
  const nameOk = file.name.toLowerCase().endsWith(".mp4");
  const typeOk = file.type === "" || file.type === "video/mp4";
  if (!nameOk || !typeOk) return "type";
  if (file.size > MAX_SIZE_BYTES) return "size";
  return null;
}

export function videoFileErrorMessage(err: VideoFileError): string {
  if (err === "size") return "Файл слишком большой. Макс 50MB";
  if (err === "type") return "Формат не поддерживается. Только .mp4";
  return "";
}

/** Загружает файл в lesson-videos под путём `${teacherId}/${uuid}.mp4` —
 *  первый сегмент пути = teacher_id, на нём завязана RLS (миграция 167). */
export async function uploadVideoFile(
  db: SupabaseClient,
  teacherId: string,
  file: File,
): Promise<{ storagePath: string; fileName: string; sizeBytes: number }> {
  const storagePath = await mySchoolStoragePath(db, teacherId, `${crypto.randomUUID()}.mp4`);
  const { error } = await db.storage
    .from("lesson-videos")
    .upload(storagePath, file, { contentType: "video/mp4" });
  if (error) throw error;
  return { storagePath, fileName: file.name, sizeBytes: file.size };
}

/** Signed URL (1 час) для video_mp4-записи. */
export async function resolveVideoUrl(db: SupabaseClient, storagePath: string): Promise<string> {
  const { data, error } = await db.storage.from("lesson-videos").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
