import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getParentContext } from "@/lib/parent-context";
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

  return <ParentAppShell>{children}</ParentAppShell>;
}
