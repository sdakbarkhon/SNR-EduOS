import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TeacherShell } from "@/components/TeacherShell";
import { TeacherHeaderInfo, TeacherHeaderSkeleton } from "@/components/TeacherHeaderInfo";
import { FullscreenLessonProvider } from "@/components/fullscreen-lesson-context";
import { ScaleWrapper } from "@/components/ScaleWrapper";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoHeartbeat } from "@/components/DemoHeartbeat";
import { DemoWelcomeModal } from "@/components/DemoWelcomeModal";
import { CurriculumReadyModal } from "@/components/CurriculumReadyModal";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { getSchoolFrozenDate, schoolNowMs } from "@/lib/school-time";
import { SchoolTimeProvider } from "@/components/SchoolTimeProvider";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // middleware.ts already redirects non-teachers away from /teacher/* using
  // the full 5-query getCurrentUserRole() priority resolution — this is a
  // defense-in-depth re-check, not the primary gate, so a single targeted
  // query is enough (same pattern app/admin/layout.tsx already uses).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (supabase as any)
    .from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) redirect("/login");

  // ШКОЛЬНОЕ «СЕЙЧАС» — ПО ВЫБРАННОЙ ШКОЛЕ, А НЕ ПО ДОМАШНЕЙ. 06.09.2026.
  //
  // Здесь стоял `teachers.school_id` — школа из строки человека. Учитель,
  // переключившийся на вторую школу, получал часы ПЕРВОЙ: у замороженной
  // школы это неподвижная дата, и весь интерфейс второй школы жил бы её
  // «сегодня» — расписание, подсветка текущего урока, запрет старта уроков за
  // прошедший день.
  //
  // Спрашиваем базу: `current_school_id()` знает и про выбор, и про запасной
  // ход на домашнюю школу. Своей копии этих правил здесь нет.
  //
  // ПОЧЕМУ НЕ getMySchoolFrozenDate, который делает ровно это. Провайдеру
  // нужен ещё и идентификатор школы, а тот резолвер отдаёт только дату:
  // позвать оба значило бы спросить базу о школе дважды. Зато теперь обе
  // величины провайдера описывают ОДНУ школу — прежде школа и её часы могли
  // разъехаться.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: выбранная } = await (supabase as any).rpc("current_school_id");
  const schoolId = (выбранная as string | null) ?? null;
  const frozenDate = await getSchoolFrozenDate(supabase, schoolId);

  // Демо-режим — свойство СЕССИИ, не аккаунта: под teacher_math может сидеть
  // и реальный учитель, и демо-гость. Кука ставится server action'ом demoLogin.
  const isDemo = (await cookies()).has(DEMO_SESSION_COOKIE);

  return (
    <SchoolTimeProvider schoolId={schoolId} frozenDate={frozenDate} serverNowMs={schoolNowMs(frozenDate)}>
    <FullscreenLessonProvider>
      <ScaleWrapper>
        <DemoWelcomeModal />
        <CurriculumReadyModal teacherId={teacher.id} />
        <DemoBanner isDemo={isDemo} />
        <DemoHeartbeat isDemo={isDemo} />
        <TeacherShell
          headerInfo={
            <Suspense fallback={<TeacherHeaderSkeleton />}>
              <TeacherHeaderInfo />
            </Suspense>
          }
        >
          {children}
        </TeacherShell>
      </ScaleWrapper>
    </FullscreenLessonProvider>
    </SchoolTimeProvider>
  );
}
