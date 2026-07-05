import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";

/** Ownership guard for every /parent/child/[studentId]/* screen — one
 *  central check instead of repeating it per-screen. A studentId that isn't
 *  linked to the logged-in parent (URL tampering, or a stale link) 404s here
 *  before any child screen renders, rather than silently leaking via a
 *  screen-specific query that happens to omit the check. */
export default async function ChildLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const ctx = await getParentContext();
  if (!ctx) redirect("/login");

  const child = resolveSelectedChild(ctx.children, studentId);
  if (!child) notFound();

  return <>{children}</>;
}
