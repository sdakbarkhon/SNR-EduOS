import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { TeacherSettingsView } from "./TeacherSettingsView";

export default async function TeacherSettingsPage() {
  const supabase = await createClient();
  const [teacherRes, groupsRes] = await Promise.all([
    safeQuery(getMyTeacher(supabase), null, "TeacherSettingsPage.teacher"),
    safeQuery(getTeacherGroups(supabase), [], "TeacherSettingsPage.groups"),
  ]);

  return <TeacherSettingsView teacher={teacherRes.data as never} groups={groupsRes.data as never[]} />;
}
