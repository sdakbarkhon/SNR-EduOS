import { getStudentAttendance } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { AttendanceView } from "./AttendanceView";

export default async function AttendancePage() {
  const db = await createClient();

  const now = new Date();
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
