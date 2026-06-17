import { createClient } from "@/lib/supabase/server";
import { getAllBooks, getBookSignedUrl } from "@snr/core";
import { TeacherBooksView } from "./TeacherBooksView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherBooksPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const teacherId = user
    ? await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then((r) => (r.data as { id: string } | null)?.id ?? "")
    : "";

  const books = await safe(getAllBooks(supabase), []);

  const coverUrls: Record<string, string> = {};
  await Promise.all(
    books
      .filter((b) => b.cover_storage_path)
      .map(async (b) => {
        try {
          coverUrls[b.id] = await getBookSignedUrl(supabase, b.cover_storage_path!);
        } catch {
          // fallback to auto-cover
        }
      })
  );

  return <TeacherBooksView initialBooks={books} initialTeacherId={teacherId} coverUrls={coverUrls} />;
}
