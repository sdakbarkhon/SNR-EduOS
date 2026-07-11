import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { TeacherSettingsView } from "./TeacherSettingsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherSettingsPage() {
  const supabase = await createClient();
  const [teacher, groups] = await Promise.all([
    safe(getMyTeacher(supabase), null),
    safe(getTeacherGroups(supabase), []),
  ]);

  return <TeacherSettingsView teacher={teacher as never} groups={groups as never[]} />;
}
