import { createClient } from "@/lib/supabase/server";
import { getCurriculumPlanById } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { notFound, redirect } from "next/navigation";
import { CurriculumPlanDetailView } from "./CurriculumPlanDetailView";

export default async function CurriculumPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [plan, teacher] = await Promise.all([
    getCurriculumPlanById(db, id),
    getMyTeacher(db),
  ]);

  if (!plan || !teacher) notFound();

  return <CurriculumPlanDetailView plan={plan} teacherId={teacher.id} />;
}
