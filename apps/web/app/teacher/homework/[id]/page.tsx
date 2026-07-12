import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTeacherHomeworkDetail, getHomeworkSubmissions,
  getTestSubmissionsForHomework, getTestQuestions,
} from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherHomeworkDetailView } from "./TeacherHomeworkDetailView";

export default async function TeacherHomeworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Промт 6: getTeacherHomeworkDetail больше не глушится — сбой раньше вёл
  // к notFound(), неотличимо от "ДЗ правда нет".
  const [hw, submissionsRes, testSubsRes, questionsRes] = await Promise.all([
    getTeacherHomeworkDetail(supabase, id),
    safeQuery(getHomeworkSubmissions(supabase, id), [], "TeacherHomeworkDetailPage.submissions"),
    safeQuery(getTestSubmissionsForHomework(supabase, id), [], "TeacherHomeworkDetailPage.testSubs"),
    safeQuery(getTestQuestions(supabase, id), [], "TeacherHomeworkDetailPage.questions"),
  ]);

  if (!hw) notFound();

  return (
    <TeacherHomeworkDetailView
      hw={hw as never}
      submissions={submissionsRes.data as never[]}
      testSubs={testSubsRes.data as never[]}
      questions={questionsRes.data as never[]}
    />
  );
}
