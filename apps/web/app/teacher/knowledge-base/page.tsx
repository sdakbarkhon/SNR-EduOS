import { createClient } from "@/lib/supabase/server";
import { getMaterials, getTeacherGroups, getAllBooks, getBookSignedUrl, getLibraryMaterials } from "@snr/core";
import type { MyDepartment } from "@snr/core";
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
   * МОИ КАФЕДРЫ — из fn_my_departments() (миграция 255), той же функции, на
   * которую опираются политики доступа к библиотеке. Интерфейс и база
   * отвечают на вопрос «моя ли это кафедра» одним и тем же способом, поэтому
   * «в списке есть, а база отказала» здесь невозможно.
   *
   * Ошибка чтения не роняет страницу: пустой список значит «кафедр нет» —
   * вкладка библиотеки будет пустой, а не сломанной.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deptRows } = await (supabase as any).rpc("fn_my_departments");
  const departments = ((deptRows ?? []) as MyDepartment[]).filter((d) => d && d.id);

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
      departments={departments}
    />
  );
}
