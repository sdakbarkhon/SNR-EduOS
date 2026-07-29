import type { Lesson } from "../types";

/**
 * "Сейчас": единственный источник истины — status='in_progress'. Никаких
 * сравнений по времени (starts_at/ends_at — плановые поля, могут не
 * совпадать с реальностью, если крон/ручной старт ещё не подхватил
 * переход) — именно расхождение между "по времени" и "по статусу" в
 * разных местах приводило к тому, что "Сейчас" показывалось сразу на
 * нескольких уроках одновременно.
 */
export function findCurrentLesson<T extends Pick<Lesson, "status">>(
  lessons: T[],
): T | null {
  return lessons.find((l) => l.status === "in_progress") ?? null;
}

/**
 * "Далее": первый scheduled-урок после текущего in_progress (по
 * starts_at); если сейчас никто не идёт — первый scheduled урок вообще
 * (в т.ч. просроченный, но так и не переведённый в in_progress вручную
 * или кроном) — иначе такой урок "теряется": не "Сейчас" (статус не
 * in_progress) и не "Далее" (время уже прошло), нигде не показывается
 * (адверсариальная проверка нашла это как реальный баг для школ без
 * автостарта, где учитель мог не успеть нажать "Начать").
 */
export function findNextLesson<T extends Pick<Lesson, "status" | "starts_at">>(
  lessons: T[],
): T | null {
  const sorted = [...lessons].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const currentIdx = sorted.findIndex((l) => l.status === "in_progress");
  if (currentIdx >= 0) {
    return sorted.slice(currentIdx + 1).find((l) => l.status === "scheduled") ?? null;
  }
  return sorted.find((l) => l.status === "scheduled") ?? null;
}
