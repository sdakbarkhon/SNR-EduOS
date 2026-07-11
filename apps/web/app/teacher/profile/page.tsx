import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
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
