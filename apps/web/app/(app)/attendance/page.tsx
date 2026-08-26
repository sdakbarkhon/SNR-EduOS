import { getStudentAttendance, tashkentMonthKey } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMySchoolNow } from "@/lib/school-time-server";
import { AttendanceView } from "./AttendanceView";

export default async function AttendancePage() {
  const db = await createClient();

  // Z.3, заход 2 — месяц по умолчанию от времени школы ученика.
  // 26.08.2026: и РАЗБИРАЕТСЯ он теперь по Ташкенту. Было getFullYear()/
  // getMonth() — они читают момент в поясе среды, а на Vercel это UTC: с
  // 00:00 до 05:00 по Ташкенту календарь открывался на прошлом месяце.
  const now = await getMySchoolNow(db);
  const defaultMonth = tashkentMonthKey(now);

  const { records, stats } = await getStudentAttendance(db);

  return (
    <AttendanceView
      initialRecords={records}
      initialStats={stats}
      defaultMonth={defaultMonth}
    />
  );
}
