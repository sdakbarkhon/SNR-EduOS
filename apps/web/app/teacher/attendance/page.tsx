import { getTeacherGroups } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { TeacherAttendanceView } from "./TeacherAttendanceView";

export default async function TeacherAttendancePage() {
  const db = await createClient();
  const groups = await getTeacherGroups(db);

  // Default to the month of the most recent lesson across all teacher groups.
  // Falls back to current month if no lessons exist yet.
  const now = new Date();
  let defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (groups.length > 0) {
    const groupIds = groups.map((g) => g.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: latestLesson } = await (db as any)
      .from("lessons")
      .select("starts_at")
      .in("group_id", groupIds)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();

    if (latestLesson?.starts_at) {
      defaultMonth = (latestLesson.starts_at as string).slice(0, 7);
    }
  }

  return <TeacherAttendanceView groups={groups} defaultMonth={defaultMonth} />;
}
