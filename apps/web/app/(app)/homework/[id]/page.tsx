import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHomeworkById } from "@snr/core";
import { HomeworkDetailView } from "./HomeworkDetailView";

export default async function HomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  let hw;
  try {
    hw = await getHomeworkById(db, id);
  } catch {
    notFound();
  }

  return <HomeworkDetailView hw={hw} />;
}
