import { createClient } from "@/lib/supabase/server";
import { getMaterials } from "@snr/core";
import { MaterialsView } from "./MaterialsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function MaterialsPage() {
  const supabase = await createClient();
  const materials = await safe(getMaterials(supabase), []);
  return <MaterialsView materials={materials} />;
}
