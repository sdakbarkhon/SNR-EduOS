import { createClient } from "@/lib/supabase/server";
import { getMaterials, getAllBooks, getMyFavoriteBookIds, getBookSignedUrl } from "@snr/core";
import { KnowledgeBaseView } from "./KnowledgeBaseView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function KnowledgeBasePage() {
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

  const [materials, books, favoriteIds] = await Promise.all([
    safe(getMaterials(supabase), []),
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
    <KnowledgeBaseView
      materials={materials}
      initialBooks={books}
      initialFavoriteIds={favoriteIds}
      studentId={studentId}
      coverUrls={coverUrls}
    />
  );
}
