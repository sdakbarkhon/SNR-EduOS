"use server";

import { createClient } from "@/lib/supabase/server";
import { getMaterialDownloadUrl } from "@snr/core";

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
    .select("storage_path, uploaded_by")
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

  // Delete file from Storage first; non-blocking if file is missing.
  if (material.storage_path) {
    const { error: storageErr } = await supabase.storage
      .from("materials")
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
    .select("id, storage_path, link_url")
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
    return await getMaterialDownloadUrl(supabase, data.storage_path as string);
  } catch (e) {
    console.error("[getMaterialUrl] createSignedUrl failed for", data.storage_path, e);
    return null;
  }
}
