import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { getLibraryMaterials, getMyGroups } from "@snr/core";
import { TeacherLibraryView } from "./TeacherLibraryView";

// 6А, Заход B — Библиотека материалов учителей (/teacher/library, migration
// 147). TeacherLayout уже гейтит роль (redirect на /login для не-учителей) —
// эта страница физически недостижима для ученика/родителя.
export default async function TeacherLibraryPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  // getMyTeacher — request-scoped cache (layout уже дёргал). subject_slug
  // NULL = куратор (teacher_karim) — наблюдательная роль: видит библиотеку,
  // но форма загрузки для него скрыта (RLS insert это же enforce'ит на БД).
  const teacher = await getMyTeacher(db);

  const [materialsRes, groupsRes] = await Promise.all([
    safeQuery(getLibraryMaterials(db), [], "TeacherLibraryPage.materials"),
    safeQuery(Promise.resolve(getMyGroups(db)), [], "TeacherLibraryPage.groups"),
  ]);

  return (
    <TeacherLibraryView
      materials={materialsRes.data}
      loadError={materialsRes.failed}
      groups={groupsRes.data as unknown as Array<{ id: string; name: string }>}
      teacherId={teacher.id}
      subjectSlug={teacher.subject_slug ?? null}
    />
  );
}
