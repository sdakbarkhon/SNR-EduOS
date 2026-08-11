import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getParentContext } from "@/lib/parent-context";
import { createClient } from "@/lib/supabase/server";
import { getSchoolFrozenDate, schoolNowMs } from "@/lib/school-time";
import { SchoolTimeProvider } from "@/components/SchoolTimeProvider";
import { ParentAppShell } from "./ParentAppShell";

/**
 * Блок 7.1 — каркас v2 больше не принимает parentName/kids/selectedChildId:
 * в макете шапку и переключатель ребёнка рисует сам экран (RootHeader /
 * ChildSwitcherCard), а не общий каркас — см. ParentAppShell.tsx. Проверка
 * доступа (есть ли вообще родительский контекст) остаётся здесь.
 */
export default async function ParentAppLayout({ children }: { children: ReactNode }) {
  const ctx = await getParentContext();
  if (!ctx) redirect("/parent");

  // Z.3, заход 1 — школа родителя и её заморозка для SchoolTimeProvider.
  // getParentContext закеширован на запрос, повторного обращения нет.
  const supabase = await createClient();
  const frozenDate = await getSchoolFrozenDate(supabase, ctx.schoolId);

  return (
    <SchoolTimeProvider schoolId={ctx.schoolId} frozenDate={frozenDate} serverNowMs={schoolNowMs(frozenDate)}>
      <ParentAppShell>{children}</ParentAppShell>
    </SchoolTimeProvider>
  );
}
