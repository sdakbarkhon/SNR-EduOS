"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMaterialDownloadUrl } from "@snr/core";
import type { LessonSlide } from "@snr/core";

export async function deleteMaterial(
  materialId: string,
): Promise<{ success?: true; error?: string }> {
  console.log("[deleteMaterial] called with id:", materialId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  // Fetch storage_path before deleting the DB row (RLS enforces teacher owns the group).
  const { data: material, error: fetchErr } = await supabase
    .from("course_materials")
    .select("storage_path, uploaded_by, bucket")
    .eq("id", materialId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[deleteMaterial] fetch error:", fetchErr);
    return { error: "not_found" };
  }
  if (!material) {
    console.warn("[deleteMaterial] not found or RLS denied:", materialId);
    return { error: "not_found" };
  }

  // Delete file from Storage first; non-blocking if file is missing. Skip for
  // bucket="lesson-materials" (migration 124, auto-published on lesson
  // completion) — that file is owned by the source lesson_materials row;
  // deleting it here would break the material inside the lesson itself.
  if (material.storage_path && material.bucket !== "lesson-materials") {
    const { error: storageErr } = await supabase.storage
      .from(material.bucket ?? "materials")
      .remove([material.storage_path]);
    if (storageErr) {
      console.error("[deleteMaterial] storage remove failed:", storageErr);
    }
  }

  // Delete the DB row (RLS policy "teacher deletes own materials" guards uploaded_by).
  const { error: dbErr } = await supabase
    .from("course_materials")
    .delete()
    .eq("id", materialId);

  if (dbErr) {
    console.error("[deleteMaterial] db delete error:", dbErr);
    return { error: "delete_failed" };
  }

  return { success: true };
}

/** Returns a 1-hour signed URL for the given material, or null if access denied.
 *  Errors are logged to the server console — silent failure on the client was
 *  hiding real Storage 404s from us. */
export async function getMaterialUrl(materialId: string): Promise<string | null> {
  console.log("[getMaterialUrl] called with id:", materialId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log("[getMaterialUrl] user:", user?.id ?? "none");
  if (!user) {
    console.warn("[getMaterialUrl] no auth user");
    return null;
  }

  // RLS verifies access; maybeSingle returns null instead of erroring on 0 rows.
  const { data, error } = await supabase
    .from("course_materials")
    .select("id, storage_path, link_url, bucket")
    .eq("id", materialId)
    .maybeSingle();

  if (error) {
    console.error("[getMaterialUrl] DB error:", error);
    return null;
  }
  if (!data) {
    console.warn("[getMaterialUrl] material not found or RLS denied:", materialId);
    return null;
  }
  if (data.link_url) return data.link_url as string;
  if (!data.storage_path) {
    console.warn("[getMaterialUrl] no storage_path on material:", materialId);
    return null;
  }

  try {
    // No downloadAs — opens inline in the viewer instead of forcing a download.
    // bucket (migration 124) defaults to "materials" for pre-existing rows.
    return await getMaterialDownloadUrl(
      supabase,
      data.storage_path as string,
      undefined,
      (data.bucket as string) ?? "materials",
    );
  } catch (e) {
    console.error("[getMaterialUrl] createSignedUrl failed for", data.storage_path, e);
    return null;
  }
}

/**
 * Слайды опубликованной презентации урока.
 *
 * У таких материалов нет ни `storage_path`, ни `link_url`: их содержимое живёт
 * в `lesson_stages.slides` (jsonb) и достаётся через `course_materials.stage_id`
 * (миграция 119). Это 276 из 308 строк «Материалов группы» — то есть основной
 * случай, а не исключение.
 *
 * 10.08.2026 — ПОЧЕМУ ЭТАП ЧИТАЕТСЯ СЛУЖЕБНЫМ КЛИЕНТОМ. Раньше он читался
 * пользовательским, и это давало расхождение прав между двумя таблицами:
 *   • `course_materials` видны ПО ГРУППЕ  (`is_my_teacher_group(group_id)`);
 *   • `lesson_stages`     читаются ПО ПРЕДМЕТУ — политика уходит в `lessons`,
 *     а та требует `is_subject_owner(subject_id)` или кураторства.
 * Учитель-предметник видел в списке ВСЕ презентации своих групп, включая чужие
 * предметы, но открыть мог только свои. Замерено под настоящим JWT: у
 * `teacher_prog` в списке 276 презентаций, а этап читается у 72 — то есть
 * 204 материала выдавали «не удалось загрузить», хотя данные целы и файлы на
 * месте (проверено: ни одной битой ссылки во всех четырёх бакетах).
 *
 * Право проверяется ЯВНО и по правильной сущности: если RLS отдала строку
 * материала, значит эта презентация опубликована в группе спрашивающего — и
 * содержимое ему полагается. Сам материал и есть публикация. Тот же приём, что
 * в projects/scratch/actions.ts: служебный клиент + явная проверка владения.
 *
 * Возврат различает три исхода, чтобы экран мог сказать человеку разное:
 *   • `ok`        — слайды есть;
 *   • `empty`     — этап реален, но слайдов в нём нет вовсе (такие материалы
 *                   создала автопубликация для практических этапов: 21 строка,
 *                   типы code/wokwi/scratch — показывать нечего);
 *   • `not_found` — материала нет либо RLS не отдала строку.
 */
export type MaterialSlidesResult =
  | { status: "ok"; slides: LessonSlide[] }
  | { status: "empty" }
  | { status: "not_found" };

export async function getMaterialSlides(materialId: string): Promise<MaterialSlidesResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "not_found" };

  // Проверка права — под пользователем: RLS решает, можно ли ему этот материал.
  const { data: material, error } = await supabase
    .from("course_materials")
    .select("stage_id")
    .eq("id", materialId)
    .maybeSingle();
  if (error) {
    console.error("[getMaterialSlides] material fetch failed:", error);
    return { status: "not_found" };
  }
  if (!material) {
    console.warn("[getMaterialSlides] material not found or RLS denied:", materialId);
    return { status: "not_found" };
  }
  if (!material.stage_id) return { status: "empty" };

  // Содержимое — служебным клиентом: право уже проверено строкой выше.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stage, error: stageErr } = await (admin as any)
    .from("lesson_stages")
    .select("slides")
    .eq("id", material.stage_id)
    .maybeSingle();
  if (stageErr) {
    console.error("[getMaterialSlides] stage fetch failed:", stageErr);
    return { status: "not_found" };
  }
  const slides = (stage?.slides as LessonSlide[] | null) ?? null;
  if (!slides || slides.length === 0) return { status: "empty" };
  return { status: "ok", slides };
}
