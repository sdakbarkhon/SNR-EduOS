import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getTeacherGradeStats } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { TeacherGradesView } from "./TeacherGradesView";

export default async function TeacherGradesPage() {
  const supabase = await createClient();

  // 24.08.2026 — «неделя» у KPI считается от ШКОЛЬНОГО «сейчас».
  // Раньше getTeacherGradeStats брал Date.now(): у демо-школы время
  // заморожено на 29.07, окно недели приходилось на пустоту, и плитка
  // «Оценено за неделю» показывала 0 при 310 проверенных работах внутри
  // школьной недели. Тот же приём, что у расписания на дашборде.
  const nowMs = await getMySchoolNowMs(supabase);

  const [groupsRes, statsRes] = await Promise.all([
    safeQuery(getTeacherGroups(supabase), [], "TeacherGradesPage.groups"),
    safeQuery(getTeacherGradeStats(supabase, nowMs), { totalGraded: 0, avgGrade: 0, weeklyGraded: 0 }, "TeacherGradesPage.stats"),
  ]);

  return <TeacherGradesView groups={groupsRes.data as never[]} stats={statsRes.data} />;
}
