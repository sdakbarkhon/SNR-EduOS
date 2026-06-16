import { createClient } from "@/lib/supabase/server";
import { getHomeworkWithSubmissions } from "@snr/core";
import { HomeworkView } from "./HomeworkView";

export default async function HomeworkPage() {
  const db = await createClient();
  const rows = await getHomeworkWithSubmissions(db);
  return <HomeworkView initialRows={rows} />;
}
