import { createClient } from "@/lib/supabase/server";
import { getAllBooks, getMyFavoriteBookIds } from "@snr/core";
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

  return (
    <BooksView
      initialBooks={books}
      initialFavoriteIds={favoriteIds}
      studentId={studentId}
    />
  );
}
