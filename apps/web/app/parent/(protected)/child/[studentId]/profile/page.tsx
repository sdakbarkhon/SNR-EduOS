import { createClient } from "@/lib/supabase/server";
import { getStudentById } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { safeQuery } from "@/lib/safe-query";
import { ProfileView } from "./ProfileView";

export default async function ChildProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const ctx = await getParentContext();
  const child = ctx ? resolveSelectedChild(ctx.children, studentId) : null;
  if (!child) return null;

  const db = await createClient();
  const { data: student } = await safeQuery(getStudentById(db, studentId), null, "ChildProfilePage.student");

  return <ProfileView child={child} student={student} />;
}
