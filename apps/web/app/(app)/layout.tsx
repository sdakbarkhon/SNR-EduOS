import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoHeartbeat } from "@/components/DemoHeartbeat";
import { DemoWelcomeModal } from "@/components/DemoWelcomeModal";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { getClassLabel } from "@/lib/student-class-label";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Демо-режим — свойство СЕССИИ, не аккаунта (teacher_math может быть и
  // реальной, и демо-сессией): кука ставится server action'ом при демо-логине.
  const isDemo = (await cookies()).has(DEMO_SESSION_COOKIE);

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
      <DemoHeartbeat isDemo={isDemo} />
      <AppShell studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} isDemo={isDemo}>{children}</AppShell>
    </>
  );
}
