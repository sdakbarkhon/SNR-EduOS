import { createClient } from "@/lib/supabase/server";
import { getStudentById } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
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
  const student = await getStudentById(db, studentId).catch(() => null);

  return <ProfileView child={child} student={student} />;
}
