import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getGroupStudents } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherGroupDetailView } from "./TeacherGroupDetailView";

export default async function TeacherGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Промт 6: getTeacherGroups больше НЕ глушится — сбой здесь раньше вёл
  // к notFound() (группа "не найдена"), неотличимо от реального 404.
  const [groups, studentsRes] = await Promise.all([
    getTeacherGroups(supabase),
    safeQuery(getGroupStudents(supabase, id), [], "TeacherGroupDetailPage.students"),
  ]);

  const group = (groups as Array<{ id: string; name: string; subject: string }>).find((g) => g.id === id);
  if (!group) notFound();

  return <TeacherGroupDetailView group={group} students={studentsRes.data as never[]} />;
}
