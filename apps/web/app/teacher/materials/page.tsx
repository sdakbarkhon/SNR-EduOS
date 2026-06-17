import { createClient } from "@/lib/supabase/server";
import { getMaterials, getTeacherGroups } from "@snr/core";
import { TeacherMaterialsView } from "./TeacherMaterialsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherMaterialsPage() {
  const supabase = await createClient();
  const [materials, groups] = await Promise.all([
    safe(getMaterials(supabase), []),
    safe(getTeacherGroups(supabase), []),
  ]);
  return <TeacherMaterialsView materials={materials} groups={groups as never[]} />;
}
