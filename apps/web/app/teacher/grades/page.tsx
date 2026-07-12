import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getTeacherGradeStats } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherGradesView } from "./TeacherGradesView";

export default async function TeacherGradesPage() {
  const supabase = await createClient();
  const [groupsRes, statsRes] = await Promise.all([
    safeQuery(getTeacherGroups(supabase), [], "TeacherGradesPage.groups"),
    safeQuery(getTeacherGradeStats(supabase), { totalGraded: 0, avgGrade: 0, weeklyGraded: 0 }, "TeacherGradesPage.stats"),
  ]);

  return <TeacherGradesView groups={groupsRes.data as never[]} stats={statsRes.data} />;
}
