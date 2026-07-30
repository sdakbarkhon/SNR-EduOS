import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@snr/core";
import { childSubjectDetail, getSelectedChild } from "@/lib/parent-queries";
import { SubjectDetailView } from "./SubjectDetailView";
import { RU, initials, subjectColor, subjectGlyph } from "../../_study/util";

/**
 * Экран #11 «Детали предмета» — веб-порт apps/mobile-parent/src/screens/study/
 * SubjectDetailScreen.tsx (ветка feat/mobile-parent-redesign).
 *
 * Данные РЕАЛЬНЫЕ: childSubjectDetail(id) → core getChildSubjectDetail со
 * studentId выбранного ребёнка. Средний балл, «освоение тем», последняя
 * оценённая работа, ближайший урок с квизом и последний комментарий учителя —
 * всё из БД; фикстурных «96%», «Гульнора Юсупова» и рекомендаций ассистента
 * из макета здесь нет вовсе, потому что под них нет источника.
 *
 * «Освоение темы» = средний балл по теме в процентах от 5.0 (ровно то, что
 * считает core по lessons.topic реально прошедших уроков) — не план курса.
 */
export default async function ParentSubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [child, detail] = await Promise.all([getSelectedChild(), childSubjectDetail(id)]);
  if (!detail) notFound();

  return (
    <SubjectDetailView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      subjectName={detail.subjectName}
      subjectGlyph={subjectGlyph(detail.subjectName)}
      color={subjectColor(detail.color)}
      teacherName={detail.teacherName}
      teacherInitials={initials(detail.teacherName)}
      average={detail.average != null ? Number(detail.average.toFixed(1)) : null}
      gradeCount={detail.gradeCount}
      topics={detail.topics.map((t) => ({
        topic: t.topic,
        pct: Math.round((t.average / 5) * 100),
        average: Number(t.average.toFixed(1)),
        count: t.count,
      }))}
      lastWork={
        detail.lastGradedHomework
          ? {
              id: detail.lastGradedHomework.id,
              title: detail.lastGradedHomework.title,
              grade: detail.lastGradedHomework.grade,
              dateLabel: detail.lastGradedHomework.gradedAt
                ? formatDate(detail.lastGradedHomework.gradedAt, RU)
                : "—",
            }
          : null
      }
      upcomingTest={
        detail.upcomingQuizLesson
          ? {
              title: detail.upcomingQuizLesson.title,
              dateLabel: formatDateTime(detail.upcomingQuizLesson.startsAt, RU),
            }
          : null
      }
      teacherComment={
        detail.lastTeacherComment
          ? {
              text: detail.lastTeacherComment.comment,
              dateLabel: detail.lastTeacherComment.gradedAt
                ? formatDateTime(detail.lastTeacherComment.gradedAt, RU)
                : "—",
            }
          : null
      }
    />
  );
}
