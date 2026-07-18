import { createClient } from "@/lib/supabase/server";
import { getTeacherAiPendingReviews } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherAiReviewView } from "./TeacherAiReviewView";

export default async function TeacherAiReviewPage() {
  const supabase = await createClient();
  const res = await safeQuery(getTeacherAiPendingReviews(supabase), [], "TeacherAiReviewPage.reviews");
  return <TeacherAiReviewView reviews={res.data as never[]} />;
}
