import { createClient } from "@/lib/supabase/server";
import { getMyTeacher, getTeacherGroups } from "@snr/core";
import { TeacherProfileView } from "./TeacherProfileView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherProfilePage() {
  const supabase = await createClient();
  const [teacher, groups] = await Promise.all([
    safe(getMyTeacher(supabase), null),
    safe(getTeacherGroups(supabase), []),
  ]);

  return <TeacherProfileView teacher={teacher as never} groups={groups as never[]} />;
}
