import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoWelcomeModal } from "@/components/DemoWelcomeModal";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { getClassLabel } from "@/lib/student-class-label";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isDemo = user.user_metadata?.is_demo === true;

  let studentName = "";
  let avatarUrl: string | null = null;
  let classLabel = "";
  try {
    const [student, groups] = await Promise.all([getMyStudent(supabase), getMyGroups(supabase)]);
    studentName = student.full_name;
    avatarUrl = (student as { avatar_url?: string | null }).avatar_url ?? null;
    classLabel = getClassLabel(groups);
  } catch {
    // профиль не найден — оставим пустым
  }

  return (
    <>
      <DemoWelcomeModal />
      <DemoBanner isDemo={isDemo} />
      <AppShell studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel}>{children}</AppShell>
    </>
  );
}
