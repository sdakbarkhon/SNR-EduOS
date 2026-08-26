import { childHomework, getSelectedChild, parentToday } from "@/lib/parent-queries";
import { subjectDisplay } from "@snr/core";
import { HomeworkListView, type HomeworkCardVM, type HomeworkDue } from "./HomeworkListView";
import {
  homeworkGradeDisplay,
  homeworkStatusKind,
  progressIndicator,
  statusFamily,
  statusLabel,
} from "../_study/homework-status";
import { subjectColor, subjectGlyph } from "../_study/util";
import { addDaysKey, tashkentDateKey } from "../_ui/format";

/**
 * Экран #12 «Домашние задания» — веб-порт apps/mobile-parent/src/screens/
 * study/HomeworksScreen.tsx (ветка feat/mobile-parent-redesign).
 *
 * Данные РЕАЛЬНЫЕ: childHomework() → core getHomeworkWithSubmissions с явным
 * studentId выбранного ребёнка (без него RLS вернул бы ДЗ всех детей семьи
 * вперемешку — молчаливая ложь, а не ошибка).
 *
 * Один запрос на весь список; фильтр-чипы считаются здесь же, на сервере, и
 * переключаются в клиенте без рефетча (тот же приём, что в мобилке). Сроки
 * форматируются в Asia/Tashkent на сервере — «сегодня/завтра» относительно
 * демо-«сегодня» (lib/demo-date), а не относительно часов браузера.
 */
export default async function ParentHomeworkPage() {
  const [child, list] = await Promise.all([getSelectedChild(), childHomework()]);

  const today = await parentToday();
  const tomorrow = addDaysKey(today, 1);

  const cards: HomeworkCardVM[] = list.map((hw) => {
    const kind = homeworkStatusKind(hw);
    const grade = homeworkGradeDisplay(hw);
    const dueKey = hw.due_date ? tashkentDateKey(hw.due_date) : null;
    const overdue = kind === "not_submitted" && !!dueKey && dueKey < today;

    // Подпись срока («Срок: завтра, 14:00») собирает клиент: и слова, и дата
    // зависят от языка. Отсюда уезжает только вид срока и его момент.
    const due: HomeworkDue =
      !hw.due_date || !dueKey
        ? { kind: "none" }
        : dueKey === today
          ? { kind: "today", at: hw.due_date }
          : dueKey === tomorrow
            ? { kind: "tomorrow", at: hw.due_date }
            : { kind: "day", dateKey: dueKey };

    return {
      id: hw.id,
      // 26.08.2026: запасной путь на hw.group.subject убран. Он не «почти
      // никогда» — дублирование задания (TeacherHomeworkView) создавало копию
      // БЕЗ subject_id, и у неё подпись становилась сырым 'programming'.
      subjectName: subjectDisplay(hw.subjectName),
      subjectGlyph: subjectGlyph(hw.subjectName),
      color: subjectColor(hw.subjectColor),
      title: hw.title,
      due,
      statusLabel: statusLabel(kind, grade),
      family: statusFamily(kind, overdue),
      progress: progressIndicator(hw),
      overdue,
      dueToday: dueKey === today,
      submitted: kind !== "not_submitted",
      graded: kind === "graded",
      pending: kind === "pending_review",
    };
  });

  return (
    <HomeworkListView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      cards={cards}
    />
  );
}
