import { getAttendanceWithLesson } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { AttendanceView } from "./AttendanceView";

export default async function AttendancePage() {
  const db = await createClient();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 1).toISOString();

  const rows = await getAttendanceWithLesson(db, { from, to });

  return (
    <AttendanceView
      initialRows={rows}
      initialYear={year}
      initialMonth={month}
    />
  );
}
