// 08.08.2026 — экран AI-проверки ДЗ у учителя. Раньше отдавал только очередь
// «ждёт подтверждения»; теперь на нём же живёт ЗАПУСК проверки по выбранным
// работам — крон /api/cron/homework-review-process снят из-за лимита кронов
// бесплатного тарифа, и запускать проверку стало некому.
//
// Второй экран не заводился намеренно: список запуска и список подтверждения
// — одни и те же строки в разных состояниях, разводить их по разным адресам
// значит заставлять учителя прыгать между ними после каждой проверки.
import { createClient } from "@/lib/supabase/server";
import { getTeacherHomeworkSubmissions } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherAiReviewView } from "./TeacherAiReviewView";

export default async function TeacherAiReviewPage() {
  const supabase = await createClient();

  // Справочник предметов школы (миграция 171) — источник вариантов фильтра
  // «Предмет». Берём только is_active: выключенные предметы в расписании не
  // встречаются, а список бы удлиняли вдвое.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subjectsRes = await safeQuery<Array<{ id: string; name: string }>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("school_subjects")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name")
      .then((r: { data: unknown; error: unknown }) => {
        if (r.error) throw r.error;
        return (r.data ?? []) as Array<{ id: string; name: string }>;
      }),
    [],
    "TeacherAiReviewPage.subjects",
  );

  const subsRes = await safeQuery(
    getTeacherHomeworkSubmissions(supabase),
    [],
    "TeacherAiReviewPage.submissions",
  );

  return (
    <TeacherAiReviewView
      submissions={subsRes.data as never[]}
      catalogSubjects={subjectsRes.data}
    />
  );
}
