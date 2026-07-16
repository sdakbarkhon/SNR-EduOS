// P3-фикс (restore 3-class student cards) — GET /api/demo/status
// Модалка снова показывает 3 карточки классов (3/7/10) вместо одной
// общей карточки «Ученик» — соответственно статус занятости теперь
// по классам, а не общий student_available.
//
// occupied_subjects: те же 5 subject_slug, что раньше (без изменений
// логики — занят, если есть активный lease role='teacher' на этот slug).
//
// occupied_grades: класс считается занятым, если количество активных
// lease role='student' с учениками ИЗ ЭТОГО класса >= количества
// активных учеников в этом классе (все свободные места разобраны).
// Класс ученика резолвится через students.grade ('N класс') — join с
// demo_leases.user_id делается вручную в JS (между demo_leases и
// students нет прямого FK, PostgREST embed не сработает).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LEASE_TIMEOUT_MS = 15 * 60 * 1000;
const GRADES = [3, 7, 10] as const;

function gradeLevelOf(grade: string | null): number | null {
  if (!grade) return null;
  const n = parseInt(grade, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const admin = createAdminClient();

  const [studentsRes, leasesRes] = await Promise.all([
    admin.from("students").select("user_id, grade").eq("status", "active"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("demo_leases")
      .select("role, subject_slug, user_id")
      .is("released_at", null)
      .gt("last_activity_at", new Date(Date.now() - LEASE_TIMEOUT_MS).toISOString()),
  ]);

  if (studentsRes.error) {
    console.error("[demo/status] students query error:", studentsRes.error.message);
    return NextResponse.json({ occupied_subjects: [] as string[], occupied_grades: [] as number[], error: "students_query_failed" }, { status: 500 });
  }
  if (leasesRes.error) {
    console.error("[demo/status] leases query error:", leasesRes.error.message);
    return NextResponse.json({ occupied_subjects: [] as string[], occupied_grades: [] as number[], error: "leases_query_failed" }, { status: 500 });
  }

  const students = (studentsRes.data ?? []) as Array<{ user_id: string; grade: string | null }>;
  const gradeByUserId = new Map<string, number>();
  const totalByGrade = new Map<number, number>();
  for (const s of students) {
    const g = gradeLevelOf(s.grade);
    if (g === null) continue; // legacy-аккаунты без класса не участвуют в grade-scoped подсчёте
    gradeByUserId.set(s.user_id, g);
    totalByGrade.set(g, (totalByGrade.get(g) ?? 0) + 1);
  }

  const leases = (leasesRes.data ?? []) as Array<{ role: string; subject_slug: string | null; user_id: string }>;
  const occupiedByGrade = new Map<number, number>();
  for (const l of leases) {
    if (l.role !== "student") continue;
    const g = gradeByUserId.get(l.user_id);
    if (g === undefined) continue;
    occupiedByGrade.set(g, (occupiedByGrade.get(g) ?? 0) + 1);
  }

  const occupiedGrades = GRADES.filter((g) => {
    const total = totalByGrade.get(g) ?? 0;
    const occupied = occupiedByGrade.get(g) ?? 0;
    return total > 0 && occupied >= total;
  });

  const occupiedSubjects = leases
    .filter((l) => l.role === "teacher" && l.subject_slug)
    .map((l) => l.subject_slug as string);

  return NextResponse.json({
    occupied_subjects: occupiedSubjects,
    occupied_grades: occupiedGrades,
  });
}
