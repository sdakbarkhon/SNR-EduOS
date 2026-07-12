import { createClient } from "@/lib/supabase/server";
import { getTeacherHomework, getTeacherGroups } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherHomeworkView } from "./TeacherHomeworkView";

export default async function TeacherHomeworkPage() {
  const supabase = await createClient();
  const [homeworkRes, groupsRes] = await Promise.all([
    safeQuery(getTeacherHomework(supabase), [], "TeacherHomeworkPage.homework"),
    safeQuery(getTeacherGroups(supabase), [], "TeacherHomeworkPage.groups"),
  ]);

  return <TeacherHomeworkView homework={homeworkRes.data as never[]} groups={groupsRes.data as never[]} />;
}
