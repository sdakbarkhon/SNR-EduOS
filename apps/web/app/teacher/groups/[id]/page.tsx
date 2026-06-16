import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getGroupStudents } from "@snr/core";
import { TeacherGroupDetailView } from "./TeacherGroupDetailView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [groups, students] = await Promise.all([
    safe(getTeacherGroups(supabase), []),
    safe(getGroupStudents(supabase, id), []),
  ]);

  const group = (groups as Array<{ id: string; name: string; subject: string }>).find((g) => g.id === id);
  if (!group) notFound();

  return <TeacherGroupDetailView group={group} students={students as never[]} />;
}
