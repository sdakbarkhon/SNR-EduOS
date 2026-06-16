import { createClient } from "@/lib/supabase/server";
import { getTeacherHomework, getTeacherGroups } from "@snr/core";
import { TeacherHomeworkView } from "./TeacherHomeworkView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherHomeworkPage() {
  const supabase = await createClient();
  const [homework, groups] = await Promise.all([
    safe(getTeacherHomework(supabase), []),
    safe(getTeacherGroups(supabase), []),
  ]);

  return <TeacherHomeworkView homework={homework as never[]} groups={groups as never[]} />;
}
