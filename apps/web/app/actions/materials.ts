"use server";

import { createClient } from "@/lib/supabase/server";
import { getMaterialDownloadUrl } from "@snr/core";

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
    return await getMaterialDownloadUrl(supabase, data.storage_path as string);
  } catch (e) {
    console.error("[getMaterialUrl] createSignedUrl failed for", data.storage_path, e);
    return null;
  }
}
