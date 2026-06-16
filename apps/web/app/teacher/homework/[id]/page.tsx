import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTeacherHomeworkDetail, getHomeworkSubmissions,
  getTestSubmissionsForHomework, getTestQuestions,
} from "@snr/core";
import { TeacherHomeworkDetailView } from "./TeacherHomeworkDetailView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherHomeworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [hw, submissions, testSubs, questions] = await Promise.all([
    safe(getTeacherHomeworkDetail(supabase, id), null),
    safe(getHomeworkSubmissions(supabase, id), []),
    safe(getTestSubmissionsForHomework(supabase, id), []),
    safe(getTestQuestions(supabase, id), []),
  ]);

  if (!hw) notFound();

  return (
    <TeacherHomeworkDetailView
      hw={hw as never}
      submissions={submissions as never[]}
      testSubs={testSubs as never[]}
      questions={questions as never[]}
    />
  );
}
