import { schoolViewContext } from "@/lib/school-view";
import { OverviewClient } from "../OverviewClient";

export const dynamic = "force-dynamic";

/** Как школа учится: несколько сводных чисел, без имён. */
export default async function SchoolAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: grades }, { data: attendance }, { data: lessons }, { data: hw }] = await Promise.all([
    db.from("lesson_grades").select("grade").eq("school_id", school.id),
    db.from("attendance").select("status").eq("school_id", school.id),
    db.from("lessons").select("status").eq("school_id", school.id),
    db.from("homework_submissions").select("grade").eq("school_id", school.id).not("grade", "is", null),
  ]);

  const оценки = (grades ?? []) as Array<{ grade: number }>;
  const среднее = оценки.length
    ? Math.round((оценки.reduce((s, g) => s + Number(g.grade), 0) / оценки.length) * 100) / 100
    : 0;

  const посещ = (attendance ?? []) as Array<{ status: string }>;
  const был = посещ.filter((a) => a.status === "present").length;
  const процент = посещ.length ? Math.round((был / посещ.length) * 100) : 0;

  const всеУроки = (lessons ?? []) as Array<{ status: string }>;
  const завершено = всеУроки.filter((l) => l.status === "completed").length;

  const дз = (hw ?? []) as Array<{ grade: number }>;
  const среднееДз = дз.length
    ? Math.round((дз.reduce((s, g) => s + Number(g.grade), 0) / дз.length) * 100) / 100
    : 0;

  return (
    <OverviewClient
      stats={[
        { labelKey: "svAnLessons", value: всеУроки.length },
        { labelKey: "svAnLessonsDone", value: завершено },
        { labelKey: "svAnGrades", value: оценки.length },
        { labelKey: "svAnAvgGrade", value: среднее },
        { labelKey: "svAnAttendance", value: процент },
        { labelKey: "svAnHomeworkGraded", value: дз.length },
        { labelKey: "svAnAvgHomework", value: среднееДз },
      ]}
      card={[]}
    />
  );
}
