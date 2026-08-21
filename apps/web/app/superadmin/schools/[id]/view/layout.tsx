import type { ReactNode } from "react";
import { schoolViewContext } from "@/lib/school-view";
import { SchoolViewShell } from "@/components/superadmin/SchoolViewShell";

/**
 * Каркас просмотра школы. Проверка «я суперадмин» и поиск школы живут в
 * schoolViewContext и повторяются на каждой странице отдельно — здесь не
 * «вместо», а «в дополнение»: макет в Next.js не защищает страницы, он лишь
 * оборачивает их разметкой, и полагаться на него как на охрану нельзя.
 */
export const dynamic = "force-dynamic";

export default async function SchoolViewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { school } = await schoolViewContext(id);

  return (
    <SchoolViewShell schoolId={school.id} schoolName={school.name} isDemo={school.isDemo}>
      {children}
    </SchoolViewShell>
  );
}
