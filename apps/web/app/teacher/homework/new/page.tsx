import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getMyTeacher } from "@snr/core";
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

  return <CreateHomeworkForm groups={groups as never[]} teacherId={(teacher as never as { id: string })?.id ?? ""} />;
}
