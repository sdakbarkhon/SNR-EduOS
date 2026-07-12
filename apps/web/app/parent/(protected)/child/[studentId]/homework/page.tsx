import { createClient } from "@/lib/supabase/server";
import { getHomeworkWithSubmissions } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { safeQuery } from "@/lib/safe-query";
import { HomeworkListView } from "./HomeworkListView";

export default async function ChildHomeworkPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const ctx = await getParentContext();
  const child = ctx ? resolveSelectedChild(ctx.children, studentId) : null;
  if (!child) return null;

  const db = await createClient();
  const { data: homework } = await safeQuery(getHomeworkWithSubmissions(db, studentId), [], "ChildHomeworkPage.homework");

  return <HomeworkListView child={child} homework={homework} />;
}
