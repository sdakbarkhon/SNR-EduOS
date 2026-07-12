import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { TeacherProfileView } from "./TeacherProfileView";

export default async function TeacherProfilePage() {
  const supabase = await createClient();
  const [teacherRes, groupsRes] = await Promise.all([
    safeQuery(getMyTeacher(supabase), null, "TeacherProfilePage.teacher"),
    safeQuery(getTeacherGroups(supabase), [], "TeacherProfilePage.groups"),
  ]);

  return <TeacherProfileView teacher={teacherRes.data as never} groups={groupsRes.data as never[]} />;
}
