import { createClient } from "@/lib/supabase/server";
import { getStudentGrades } from "@snr/core";
import { GradesView } from "./GradesView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function GradesPage() {
  const supabase = await createClient();
  const grades = await safe(getStudentGrades(supabase), []);
  return <GradesView grades={grades} />;
}
