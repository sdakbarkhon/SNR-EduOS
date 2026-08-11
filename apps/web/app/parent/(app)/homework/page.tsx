import { formatTime } from "@snr/core";
import { childHomework, getSelectedChild, parentToday } from "@/lib/parent-queries";
import { HomeworkListView, type HomeworkCardVM } from "./HomeworkListView";
import {
  homeworkGradeDisplay,
  homeworkStatusKind,
  progressIndicator,
  statusFamily,
  statusLabel,
} from "../_study/homework-status";
import { RU, addDaysKey, ruDayMonth, subjectColor, subjectGlyph, tashkentDateKey } from "../_study/util";

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

    let dueLabel: string;
    if (!hw.due_date || !dueKey) {
      dueLabel = "Без срока";
    } else if (dueKey === today) {
      dueLabel = `Срок: сегодня, ${formatTime(hw.due_date, RU)}`;
    } else if (dueKey === tomorrow) {
      dueLabel = `Срок: завтра, ${formatTime(hw.due_date, RU)}`;
    } else {
      dueLabel = `Срок: ${ruDayMonth(dueKey)}`;
    }

    return {
      id: hw.id,
      subjectName: hw.subjectName ?? hw.group.subject ?? "Предмет",
      subjectGlyph: subjectGlyph(hw.subjectName ?? hw.group.subject),
      color: subjectColor(hw.subjectColor),
      title: hw.title,
      dueLabel,
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
