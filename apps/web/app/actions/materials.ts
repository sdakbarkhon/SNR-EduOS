"use server";

import { createClient } from "@/lib/supabase/server";
import { getMaterialDownloadUrl } from "@snr/core";

/** Returns a 1-hour signed URL for the given material, or null if access denied. */
export async function getMaterialUrl(materialId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS verifies the user has access to this material (student group or teacher group)
  const { data } = await supabase
    .from("course_materials")
    .select("id, storage_path, link_url")
    .eq("id", materialId)
    .single();

  if (!data) return null;
  if (data.link_url) return data.link_url as string;
  if (!data.storage_path) return null;

  try {
    return await getMaterialDownloadUrl(supabase, data.storage_path as string);
  } catch {
    return null;
  }
}
