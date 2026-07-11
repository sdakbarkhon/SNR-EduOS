import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { CreateHomeworkForm } from "./CreateHomeworkForm";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function NewHomeworkPage() {
  const supabase = await createClient();
  const [groups, teacher] = await Promise.all([
    safe(getTeacherGroups(supabase), []),
    safe(getMyTeacher(supabase), null),
  ]);

  // Every subject across every group this teacher can access (curator OR
  // co-teacher via group_teachers), not just subjects.teacher_id ownership —
  // same query as apps/web/app/teacher/lessons/page.tsx, so co-teachers get
  // the same subject list here as when creating a lesson.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subjects } = groups.length > 0
    ? await (supabase as any)
        .from("subjects")
        .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
        .in("group_id", (groups as Array<{ id: string }>).map((g) => g.id))
        .order("name")
    : { data: [] };

  return (
    <CreateHomeworkForm
      groups={groups as never[]}
      subjects={subjects ?? []}
      teacherId={(teacher as never as { id: string })?.id ?? ""}
    />
  );
}
