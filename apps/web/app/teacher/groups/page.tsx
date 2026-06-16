import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getTeacherHomework } from "@snr/core";
import { TeacherGroupsView } from "./TeacherGroupsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherGroupsPage() {
  const supabase = await createClient();
  const [groups, homework] = await Promise.all([
    safe(getTeacherGroups(supabase), []),
    safe(getTeacherHomework(supabase), []),
  ]);

  return <TeacherGroupsView groups={groups as never[]} homework={homework as never[]} />;
}
