import type { ReactNode } from "react";
import { schoolViewContext } from "@/lib/school-view";
import { signLogoUrl } from "@/lib/school-card";
import { SchoolViewShell } from "@/components/superadmin/SchoolViewShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuickStartButton } from "@/app/admin/QuickStartModal";

/**
 * Каркас «менеджер смотрит школу». Та же оболочка, что у суперадмина, — она
 * приняла три необязательных свойства и служит обоим.
 *
 * ПРОВЕРКА ЖИВЁТ В schoolViewContext и повторяется на каждой странице
 * отдельно; здесь не «вместо», а «в дополнение»: макет в Next.js не защищает
 * страницы, он лишь оборачивает их разметкой.
 *
 * ЛОГОТИП — ПРОСЬБА ЗАКАЗЧИКА. «Чтобы всё фильтровалось и чётко было
 * различно, чтобы не путать с другими школами». Менеджер ходит по чужим
 * школам подряд, и знак школы он узнаёт боковым зрением быстрее, чем читает
 * название. Взято из шапки админки, где это уже сделано.
 *
 * Суперадминский макет логотип НЕ передаёт, и его полоса выглядит как вчера.
 */
export const dynamic = "force-dynamic";

export default async function ManagerSchoolViewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { school } = await schoolViewContext(id);

  // Путь к логотипу лежит в той же строке школы, но schoolViewContext его не
  // отдаёт: суперадминским экранам он не нужен, и раздувать общий тип ради
  // одного макета незачем. Один запрос служебным ключом, как и всё здесь.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createAdminClient() as any)
    .from("schools").select("logo_path").eq("id", school.id).maybeSingle();

  return (
    <SchoolViewShell
      schoolId={school.id}
      schoolName={school.name}
      isDemo={school.isDemo}
      basePath={`/manager/schools/${school.id}/view`}
      exitHref="/manager/schools"
      logoUrl={await signLogoUrl((data as { logo_path?: string | null } | null)?.logo_path)}
      cardTab
      extra={<QuickStartButton schoolId={school.id} canPrice />}
    >
      {children}
    </SchoolViewShell>
  );
}
