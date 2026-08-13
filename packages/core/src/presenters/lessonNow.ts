import type { Lesson } from "../types";

/** Момент запуска урока. started_at появляется при переводе в in_progress
 *  (миграция 26); если его нет — опираемся на плановое начало. */
function startedKey(lesson: { started_at?: string | null; starts_at?: string | null }): number {
  const raw = lesson.started_at ?? lesson.starts_at ?? null;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * "Сейчас": единственный источник истины — status='in_progress'. Никаких
 * сравнений по времени (starts_at/ends_at — плановые поля, могут не
 * совпадать с реальностью, если крон/ручной старт ещё не подхватил
 * переход) — именно расхождение между "по времени" и "по статусу" в
 * разных местах приводило к тому, что "Сейчас" показывалось сразу на
 * нескольких уроках одновременно.
 *
 * ЕСЛИ ИДУЩИХ УРОКОВ НЕСКОЛЬКО — берём запущенный ПОСЛЕДНИМ. Раньше здесь
 * стоял find(), то есть первый по порядку массива, и подсветка застревала
 * на ранее начатом уроке. Так и проявился баг: учитель активировал третий
 * урок, потом четвёртый, а "Сейчас" осталось на третьем.
 *
 * Само по себе "несколько in_progress" — не норма: их закрывает триггер
 * trg_close_other_in_progress_lessons. Но он закрывает только уроки с
 * ДРУГИМ started_at, а в школе с замороженным временем два урока, начатых
 * в один и тот же замороженный момент, получают одинаковый started_at —
 * и предыдущий не закрывается. Подсветка не должна на это ломаться:
 * последний запущенный и есть тот, который учитель только что открыл.
 */
export function findCurrentLesson<T extends Pick<Lesson, "status">>(
  lessons: T[],
): T | null {
  const running = lessons.filter((l) => l.status === "in_progress");
  if (running.length <= 1) return running[0] ?? null;
  return [...running].sort(
    (a, b) => startedKey(b as unknown as Lesson) - startedKey(a as unknown as Lesson),
  )[0] ?? null;
}

/**
 * "Далее": первый scheduled-урок после текущего (по starts_at); если
 * сейчас никто не идёт — первый scheduled урок вообще (в т.ч.
 * просроченный, но так и не переведённый в in_progress вручную или
 * кроном) — иначе такой урок "теряется": не "Сейчас" (статус не
 * in_progress) и не "Далее" (время уже прошло), нигде не показывается
 * (адверсариальная проверка нашла это как реальный баг для школ без
 * автостарта, где учитель мог не успеть нажать "Начать").
 *
 * "Текущий" здесь берётся тем же findCurrentLesson, а не первым попавшимся
 * in_progress: иначе при двух идущих уроках "Сейчас" и "Далее" считались
 * от разных точек отсчёта и между ними проваливался целый урок.
 */
export function findNextLesson<T extends Pick<Lesson, "status" | "starts_at">>(
  lessons: T[],
): T | null {
  const sorted = [...lessons].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const current = findCurrentLesson(sorted);
  if (current) {
    const currentIdx = sorted.indexOf(current);
    return sorted.slice(currentIdx + 1).find((l) => l.status === "scheduled") ?? null;
  }
  return sorted.find((l) => l.status === "scheduled") ?? null;
}
