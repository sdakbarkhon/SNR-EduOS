import { getStudentAttendance } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMySchoolNow } from "@/lib/school-time-server";
import { AttendanceView } from "./AttendanceView";

export default async function AttendancePage() {
  const db = await createClient();

  // Z.3, заход 2 — месяц по умолчанию от времени школы ученика.
  const now = await getMySchoolNow(db);
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { records, stats } = await getStudentAttendance(db);

  return (
    <AttendanceView
      initialRecords={records}
      initialStats={stats}
      defaultMonth={defaultMonth}
    />
  );
}
