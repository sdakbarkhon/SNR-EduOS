import { createClient } from "@/lib/supabase/server";
import { getStudentGrades } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { GradesView } from "./GradesView";

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: grades, failed } = await safeQuery(getStudentGrades(supabase), [], "GradesPage.grades");
  return <GradesView grades={grades} error={failed} />;
}
