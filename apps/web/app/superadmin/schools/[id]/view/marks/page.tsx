import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

const ПОКАЗЫВАЕМ = 200;

/**
 * Оценки за уроки — последние двести. Экран правки оценок из админки
 * (/admin/marks) НЕ переиспользуется вовсе: там правка идёт прямо из браузера
 * под правилами базы, а правило is_school_admin_of() отвечает суперадмину «да»
 * про любую школу. Здесь только чтение и никаких действий.
 */
export default async function SchoolMarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: grades }, { data: students }, { data: lessons }] = await Promise.all([
    db.from("lesson_grades").select("id, student_id, lesson_id, grade, graded_at")
      .eq("school_id", school.id).order("graded_at", { ascending: false }).limit(ПОКАЗЫВАЕМ),
    db.from("students").select("id, full_name").eq("school_id", school.id),
    db.from("lessons").select("id, topic, lesson_no").eq("school_id", school.id),
  ]);

  const уч = new Map<string, string>((students ?? []).map((s: { id: string; full_name: string }) => [s.id, s.full_name] as const));
  const ур = new Map<string, string>((lessons ?? []).map((l: { id: string; topic: string | null; lesson_no: number | null }) =>
    [l.id, l.topic ?? (l.lesson_no != null ? `#${l.lesson_no}` : null)]));

  const rows = (grades ?? []).map((g: {
    id: string; student_id: string; lesson_id: string; grade: number; graded_at: string;
  }) => ({
    id: g.id,
    student: уч.get(g.student_id) ?? null,
    lesson: ур.get(g.lesson_id) ?? null,
    grade: g.grade,
    at: new Date(g.graded_at).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" }),
  }));

  return (
    <TableClient
      titleKey="svTabMarks"
      noteKey="svMarksNote"
      columns={[
        { key: "student", labelKey: "svColStudent" },
        { key: "lesson", labelKey: "svColLesson" },
        { key: "grade", labelKey: "svColMark", right: true, narrow: true },
        { key: "at", labelKey: "svColDate", right: true, narrow: true },
      ]}
      rows={rows}
    />
  );
}
