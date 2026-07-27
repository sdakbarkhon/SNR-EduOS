import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import { ParentAppShell } from "./ParentAppShell";

export default async function ParentAppLayout({ children }: { children: ReactNode }) {
  const ctx = await getParentContext();
  if (!ctx) redirect("/parent");

  const cookieStore = await cookies();
  const cookieChildId = cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null;
  const selected = resolveSelectedChild(ctx.children, cookieChildId);

  return (
    <ParentAppShell parentName={ctx.parentName} kids={ctx.children} selectedChildId={selected?.id ?? null}>
      {children}
    </ParentAppShell>
  );
}
