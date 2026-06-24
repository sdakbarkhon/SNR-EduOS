import { getTeacherGroups } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { TeacherAttendanceView } from "./TeacherAttendanceView";

export default async function TeacherAttendancePage() {
  const db = await createClient();
  const groups = await getTeacherGroups(db);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return <TeacherAttendanceView groups={groups} defaultMonth={defaultMonth} />;
}
