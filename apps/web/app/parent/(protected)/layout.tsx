import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getParentContext, SELECTED_CHILD_COOKIE } from "@/lib/parent-context";
import { ParentShell } from "./ParentShell";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const ctx = await getParentContext();
  if (!ctx) redirect("/login");

  const cookieStore = await cookies();
  const cookieChildId = cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null;
  const defaultChildId =
    ctx.children.find((c) => c.id === cookieChildId)?.id ?? ctx.children[0]?.id ?? null;

  return (
    <ParentShell parentName={ctx.parentName} kids={ctx.children} defaultChildId={defaultChildId}>
      {children}
    </ParentShell>
  );
}
