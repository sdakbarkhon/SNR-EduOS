// 08.08.2026 — класс (номер параллели) по названию группы.
//
// В таблице `groups` колонки с номером класса НЕТ: там только id, name,
// subject, teacher_id, course_price, schedule_days, school_id. Номер живёт
// исключительно в названии — «3-А класс», «7-А класс», «10-А класс».
//
// Разбор имени уже применялся в lib/ai/process-homework-review-queue.ts
// (gradeFromGroupName — определяет, для какого класса Gemini проверяет ДЗ);
// эта функция вынесена оттуда, чтобы второй копии не появилось. В этом
// проекте копии расходились уже пять раз.
//
// Осторожно с порядком разбора: «10-А класс» обязан дать 10, а не 1 —
// поэтому берём первую ЦЕЛУЮ группу цифр, а не первый символ-цифру.

/** Номер класса из названия группы, либо null если распознать не удалось. */
export function gradeFromGroupName(name: string | null | undefined): number | null {
  const m = (name ?? "").match(/(\d{1,2})/);
  if (!m) return null;
  const g = parseInt(m[1]!, 10);
  return Number.isFinite(g) && g >= 1 && g <= 12 ? g : null;
}

/** Младшие классы — 1-5. Scratch как ТИП ЭТАПА урока доступен только им
 *  (решение заказчика); в песочнице он открыт всем классам. */
export const JUNIOR_GRADE_MAX = 5;

export function isJuniorGroup(name: string | null | undefined): boolean {
  const g = gradeFromGroupName(name);
  // Не распознали — считаем НЕ младшим: лучше не показать пункт учителю
  // старших классов, чем показать его там, где заказчик просил не показывать.
  return g !== null && g <= JUNIOR_GRADE_MAX;
}
