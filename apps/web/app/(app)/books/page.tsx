import { createClient } from "@/lib/supabase/server";
import { getAllBooks, getMyFavoriteBookIds, getBookSignedUrl } from "@snr/core";
import { BooksView } from "./BooksView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function BooksPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const studentId = user
    ? await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then((r) => (r.data as { id: string } | null)?.id ?? "")
    : "";

  const [books, favoriteIds] = await Promise.all([
    safe(getAllBooks(supabase), []),
    safe(getMyFavoriteBookIds(supabase), []),
  ]);

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

  return (
    <BooksView
      initialBooks={books}
      initialFavoriteIds={favoriteIds}
      studentId={studentId}
      coverUrls={coverUrls}
    />
  );
}
