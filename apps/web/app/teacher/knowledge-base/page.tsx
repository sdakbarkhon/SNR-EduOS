import { createClient } from "@/lib/supabase/server";
import { getMaterials, getTeacherGroups, getAllBooks, getBookSignedUrl, getLibraryMaterials } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherKnowledgeBaseView } from "./TeacherKnowledgeBaseView";

export default async function TeacherKnowledgeBasePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const teacherRow = user
    ? await supabase
        .from("teachers")
        .select("id, subject_slug")
        .eq("user_id", user.id)
        .maybeSingle()
        .then((r) => r.data as { id: string; subject_slug: string | null } | null)
    : null;
  const teacherId = teacherRow?.id ?? "";

  /**
   * Предметы кафедры — ВСЕ, а не один из карточки.
   *
   * teachers.subject_slug заполняется при ПЕРВОМ назначении и больше не
   * меняется, поэтому учитель двух предметов видел кафедру только первого.
   * Список приходит из fn_my_subject_slugs() (миграции 190/191) — той же
   * функции, на которую опираются политики доступа к библиотеке, так что
   * интерфейс и база отвечают на вопрос «мои предметы» одинаково.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slugRows } = await (supabase as any).rpc("fn_my_subject_slugs");
  const subjectSlugs = ((slugRows ?? []) as Array<{ subject_slug: string } | string>)
    .map((r) => (typeof r === "string" ? r : r.subject_slug))
    .filter((s): s is string => Boolean(s));
  const subjectSlug = subjectSlugs[0] ?? teacherRow?.subject_slug ?? null;

  const [materialsRes, groupsRes, booksRes, libraryRes] = await Promise.all([
    safeQuery(getMaterials(supabase), [], "TeacherKnowledgeBasePage.materials"),
    safeQuery(getTeacherGroups(supabase), [], "TeacherKnowledgeBasePage.groups"),
    safeQuery(getAllBooks(supabase), [], "TeacherKnowledgeBasePage.books"),
    safeQuery(getLibraryMaterials(supabase), [], "TeacherKnowledgeBasePage.libraryMaterials"),
  ]);
  const materials = materialsRes.data;
  const groups = groupsRes.data;
  const books = booksRes.data;
  const libraryMaterials = libraryRes.data;

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
    <TeacherKnowledgeBaseView
      materials={materials}
      groups={groups as never[]}
      initialTeacherId={teacherId}
      books={books}
      coverUrls={coverUrls}
      libraryMaterials={libraryMaterials}
      initialSubjectSlug={subjectSlug}
      subjectSlugs={subjectSlugs}
    />
  );
}
