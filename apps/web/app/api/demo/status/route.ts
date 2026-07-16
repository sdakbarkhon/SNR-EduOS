// P2-фикс (revert бага А) — GET /api/demo/status
// Заменяет прежний /api/demo/teacher-status: модалка теперь показывает
// занятость и ученика (1 карточка), и 5 предметников — единый ответ
// удобнее одного round trip'а на открытие модалки.
//
// student_available: есть ли хоть 1 свободный активный студент (из ~96 —
// все active после конверсии 90 demo → real миграцией 132). Считается
// прямыми запросами через service_role (RLS на demo_leases не пускает
// клиента, но admin-клиент её обходит) — без похода в RPC, чтобы не
// плодить лишнюю функцию поверх уже имеющихся claim/heartbeat/release.
//
// occupied_subjects: те же 5 subject_slug, что раньше отдавал
// get_occupied_teacher_subjects (RPC, миграция 133) — здесь считаем
// напрямую по той же таблице одним запросом вместе со студентами.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LEASE_TIMEOUT_MS = 15 * 60 * 1000;

export async function GET() {
  const admin = createAdminClient();

  const [studentsRes, leasesRes] = await Promise.all([
    admin.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("demo_leases")
      .select("role, subject_slug")
      .is("released_at", null)
      .gt("last_activity_at", new Date(Date.now() - LEASE_TIMEOUT_MS).toISOString()),
  ]);

  if (studentsRes.error) {
    console.error("[demo/status] students count error:", studentsRes.error.message);
    return NextResponse.json({ student_available: true, occupied_subjects: [] as string[], error: "students_query_failed" }, { status: 500 });
  }
  if (leasesRes.error) {
    console.error("[demo/status] leases query error:", leasesRes.error.message);
    return NextResponse.json({ student_available: true, occupied_subjects: [] as string[], error: "leases_query_failed" }, { status: 500 });
  }

  const totalActiveStudents = studentsRes.count ?? 0;
  const leases = (leasesRes.data ?? []) as Array<{ role: string; subject_slug: string | null }>;
  const activeStudentLeases = leases.filter((l) => l.role === "student").length;
  const occupiedSubjects = leases
    .filter((l) => l.role === "teacher" && l.subject_slug)
    .map((l) => l.subject_slug as string);

  return NextResponse.json({
    student_available: totalActiveStudents - activeStudentLeases > 0,
    occupied_subjects: occupiedSubjects,
  });
}
