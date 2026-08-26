import { notFound } from "next/navigation";
import { subjectDisplay } from "@snr/core";
import { childHomeworkDetail, getSelectedChild } from "@/lib/parent-queries";
import { HomeworkDetailView } from "./HomeworkDetailView";
import {
  homeworkGradeDisplay,
  homeworkStatusKind,
  statusFamily,
  statusLabel,
} from "../../_study/homework-status";
import { fileExtLabel, fileSizeLabel, initials, subjectColor, subjectGlyph } from "../../_study/util";

/**
 * Экран #13 «Детали задания» — веб-порт apps/mobile-parent/src/screens/study/
 * HomeworkDetailScreen.tsx (ветка feat/mobile-parent-redesign), ветка
 * реального входа (isRealFlow).
 *
 * Данные РЕАЛЬНЫЕ: childHomeworkDetail(id) → core getChildHomeworkDetail,
 * которая переиспользует getHomeworkWithSubmissions со studentId выбранного
 * ребёнка. Поэтому чужое задание (не из групп этого ребёнка) не найдётся и
 * страница честно отдаёт 404, а не показывает данные другого ученика.
 *
 * Родитель — READ ONLY: блоков «Отправить работу» / «Отправить обновлённую
 * работу» здесь нет вовсе (в мобилке они тоже скрыты для real-флоу).
 * Степпер из 4 фиктивных дат не переносится — под него нет реальных данных.
 */
export default async function ParentHomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [child, hw] = await Promise.all([getSelectedChild(), childHomeworkDetail(id)]);
  if (!hw) notFound();

  const kind = homeworkStatusKind(hw);
  const grade = homeworkGradeDisplay(hw);
  const family = statusFamily(kind, false);

  const sub = hw.submission;
  const test = hw.test_submission;

  return (
    <HomeworkDetailView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      subjectName={subjectDisplay(hw.subjectName)}
      subjectGlyph={subjectGlyph(hw.subjectName)}
      color={subjectColor(hw.subjectColor)}
      title={hw.title}
      description={hw.description}
      statusLabel={statusLabel(kind, grade)}
      family={family}
      gradeDisplay={grade}
      dueAt={hw.due_date}
      createdAt={hw.created_at}
      teacherName={hw.teacherName}
      teacherInitials={initials(hw.teacherName)}
      contentType={hw.content_type}
      attachment={
        hw.attachment_filename
          ? {
              name: hw.attachment_filename,
              ext: fileExtLabel(hw.attachment_filename),
              size: fileSizeLabel(hw.attachment_size_bytes),
              externalUrl: hw.attachment_source_url ?? hw.attachment_external_url,
            }
          : null
      }
      submission={
        sub
          ? {
              submittedAt: sub.submitted_at,
              answerText: sub.answer_text,
              codeText: sub.code_text,
              fileName: sub.file_original_name,
              fileExt: fileExtLabel(sub.file_original_name),
              fileSize: fileSizeLabel(sub.file_size_bytes),
              teacherComment: sub.teacher_comment,
            }
          : null
      }
      test={
        test
          ? {
              submittedAt: test.submitted_at,
              score: test.score,
              maxScore: test.max_score,
            }
          : null
      }
    />
  );
}
