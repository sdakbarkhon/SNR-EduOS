import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/TeacherShell";
import { TeacherHeaderInfo, TeacherHeaderSkeleton } from "@/components/TeacherHeaderInfo";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoHeartbeat } from "@/components/DemoHeartbeat";
import { DemoWelcomeModal } from "@/components/DemoWelcomeModal";
import { createClient } from "@/lib/supabase/server";

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
