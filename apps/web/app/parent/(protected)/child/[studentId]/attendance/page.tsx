import { createClient } from "@/lib/supabase/server";
import { getStudentAttendance } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { AttendanceView } from "./AttendanceView";

export default async function ChildAttendancePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const ctx = await getParentContext();
  const child = ctx ? resolveSelectedChild(ctx.children, studentId) : null;
  if (!child) return null;

  const db = await createClient();
  const { records } = await getStudentAttendance(db, {}, studentId).catch(() => ({
    records: [] as Awaited<ReturnType<typeof getStudentAttendance>>["records"],
    stats: { total: 0, present: 0, excused: 0, unexcused: 0, percentage: 0 },
  }));

  return <AttendanceView child={child} records={records} />;
}
