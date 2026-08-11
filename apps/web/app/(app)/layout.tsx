import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { FullscreenLessonProvider } from "@/components/fullscreen-lesson-context";
import { ScaleWrapper } from "@/components/ScaleWrapper";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoHeartbeat } from "@/components/DemoHeartbeat";
import { DemoWelcomeModal } from "@/components/DemoWelcomeModal";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { getClassLabel } from "@/lib/student-class-label";
import { getSchoolFrozenDate } from "@/lib/school-time";
import { SchoolTimeProvider } from "@/components/SchoolTimeProvider";
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
  // Z.3, заход 1 — школа ученика и её заморозка для SchoolTimeProvider.
  // school_id приходит бесплатно: getMyStudent делает select("*").
  let schoolId: string | null = null;
  let frozenDate: string | null = null;
  try {
    const [student, groups] = await Promise.all([getMyStudent(supabase), getMyGroups(supabase)]);
    studentName = student.full_name;
    avatarUrl = (student as { avatar_url?: string | null }).avatar_url ?? null;
    classLabel = getClassLabel(groups);
    schoolId = (student as { school_id?: string | null }).school_id ?? null;
    frozenDate = await getSchoolFrozenDate(supabase, schoolId);
  } catch {
    // профиль не найден — оставим пустым. frozenDate=null означает настоящее
    // время: безопаснее, чем заморозить того, про чью школу мы не знаем.
  }

  return (
    <SchoolTimeProvider schoolId={schoolId} frozenDate={frozenDate}>
      <FullscreenLessonProvider>
        <ScaleWrapper>
          <DemoWelcomeModal />
          <DemoBanner isDemo={isDemo} />
          <DemoHeartbeat isDemo={isDemo} />
          <AppShell studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} isDemo={isDemo}>{children}</AppShell>
        </ScaleWrapper>
      </FullscreenLessonProvider>
    </SchoolTimeProvider>
  );
}
