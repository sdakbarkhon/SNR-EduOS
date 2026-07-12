import { createClient } from "@/lib/supabase/server";
import { getMaterials, getAllBooks, getMyFavoriteBookIds, getBookSignedUrl } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { KnowledgeBaseView } from "./KnowledgeBaseView";

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

  const [materialsRes, booksRes, favoriteIdsRes] = await Promise.all([
    safeQuery(getMaterials(supabase), [], "KnowledgeBasePage.materials"),
    safeQuery(getAllBooks(supabase), [], "KnowledgeBasePage.books"),
    safeQuery(getMyFavoriteBookIds(supabase), [], "KnowledgeBasePage.favoriteIds"),
  ]);
  const materials = materialsRes.data;
  const books = booksRes.data;
  const favoriteIds = favoriteIdsRes.data;

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
