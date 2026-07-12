import { createClient } from "@/lib/supabase/server";
import { getStudentGrades } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { safeQuery } from "@/lib/safe-query";
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
  const { data: grades } = await safeQuery(getStudentGrades(db, studentId), [], "ChildGradesPage.grades");

  return <GradesView child={child} grades={grades} />;
}
