import { createClient } from "@/lib/supabase/server";
import { getMaterials, getTeacherGroups } from "@snr/core";
import { TeacherMaterialsView } from "./TeacherMaterialsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherMaterialsPage() {
  const supabase = await createClient();

  // Resolve teacher id server-side — avoids a client-side query that would
  // 406 because .single() sees multiple rows under the blanket SELECT policy.
  const { data: { user } } = await supabase.auth.getUser();
  const teacherId = user
    ? await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then((r) => (r.data as { id: string } | null)?.id ?? "")
    : "";

  const [materials, groups] = await Promise.all([
    safe(getMaterials(supabase), []),
    safe(getTeacherGroups(supabase), []),
  ]);

  return (
    <TeacherMaterialsView
      materials={materials}
      groups={groups as never[]}
      initialTeacherId={teacherId}
    />
  );
}
