import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/TeacherShell";
import { TeacherHeaderInfo, TeacherHeaderSkeleton } from "@/components/TeacherHeaderInfo";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoHeartbeat } from "@/components/DemoHeartbeat";
import { DemoWelcomeModal } from "@/components/DemoWelcomeModal";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const role = await getCurrentUserRole(supabase, user.id);
  if (role !== "teacher") redirect("/login");

  const isDemo = user.user_metadata?.is_demo === true;

  return (
    <>
      <DemoWelcomeModal />
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
    </>
  );
}
