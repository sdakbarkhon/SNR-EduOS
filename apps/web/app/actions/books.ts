"use server";

import { createClient } from "@/lib/supabase/server";
import { getBookSignedUrl } from "@snr/core";

/** Returns a 1-hour signed URL for a book file, or null if access denied. */
export async function getBookFileUrl(bookId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("books")
    .select("id, file_storage_path, title")
    .eq("id", bookId)
    .maybeSingle();

  if (error || !data) return null;

  try {
    const filename = (data.file_storage_path as string).split("/").pop() || "book.pdf";
    return await getBookSignedUrl(supabase, data.file_storage_path as string, filename);
  } catch (e) {
    console.error("[getBookFileUrl] failed:", e);
    return null;
  }
}

/** Deletes a book record and its Storage files. RLS enforces teacher owns it. */
export async function deleteBook(bookId: string): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: book, error: fetchErr } = await supabase
    .from("books")
    .select("file_storage_path, cover_storage_path")
    .eq("id", bookId)
    .maybeSingle();

  if (fetchErr || !book) return { error: "not_found" };

  const paths: string[] = [];
  if (book.file_storage_path) paths.push(book.file_storage_path as string);
  if (book.cover_storage_path) paths.push(book.cover_storage_path as string);

  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage.from("books").remove(paths);
    if (storageErr) console.error("[deleteBook] storage remove failed:", storageErr);
  }

  const { error: dbErr } = await supabase.from("books").delete().eq("id", bookId);
  if (dbErr) return { error: "delete_failed" };

  return { success: true };
}
