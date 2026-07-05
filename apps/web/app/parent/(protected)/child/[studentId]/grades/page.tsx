import { createClient } from "@/lib/supabase/server";
import { getStudentGrades } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { GradesView } from "./GradesView";

export default async function ChildGradesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const ctx = await getParentContext();
  const child = ctx ? resolveSelectedChild(ctx.children, studentId) : null;
  if (!child) return null;

  const db = await createClient();
  const grades = await getStudentGrades(db, studentId).catch(() => []);

  return <GradesView child={child} grades={grades} />;
}
