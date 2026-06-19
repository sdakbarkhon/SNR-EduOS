import { createClient } from "@/lib/supabase/server";
import { getHomeworkWithSubmissions } from "@snr/core";
import { HomeworkView } from "./HomeworkView";

export default async function HomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const db = await createClient();
  const [rows, params] = await Promise.all([
    getHomeworkWithSubmissions(db),
    searchParams,
  ]);
  const initialSubject = params.subject ?? "all";
  return <HomeworkView initialRows={rows} initialSubject={initialSubject} />;
}
