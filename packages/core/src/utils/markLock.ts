/**
 * Замок на выставленное учителем. Миграция 203.
 *
 * ПРАВИЛО. Учитель поставил оценку или отметку → 15 минут может исправить свою
 * ошибку → дальше запись запирается, и менять её может только администратор
 * школы. Здесь только СЧЁТ времени для интерфейса: настоящий запрет стоит
 * триггером в базе (fn_lock_teacher_marks), обойти его через API нельзя.
 *
 * ОТ КАКОГО ВРЕМЕНИ СЧИТАЕМ. От настоящих часов, а не от «школьного»
 * замороженного времени: метки graded_at/marked_at пишет now() базы. Сравнивать
 * их с замороженной датой школы значило бы сравнивать разные шкалы — в
 * демо-школе всё запиралось бы в ту же секунду.
 */

/** Столько времени у учителя на исправление. Держать в синхроне с
 *  public.mark_edit_window() — там та же величина, и она главная. */
export const MARK_EDIT_WINDOW_MINUTES = 15;

export type MarkLockState = {
  /** true — менять значение может только администратор школы. */
  locked: boolean;
  /** Сколько целых минут ещё можно править (0, если уже заперто). */
  minutesLeft: number;
  /** Значения ещё нет — это выставление, а не изменение: замок не при чём. */
  notSetYet: boolean;
};

/**
 * Состояние замка по отметке времени выставления.
 *
 * @param stamp graded_at или marked_at записи; null — ещё не выставляли.
 * @param nowMs текущее время в миллисекундах; передаётся, чтобы экран мог
 *   пересчитывать состояние по таймеру, не дёргая часы внутри рендера.
 */
export function markLockState(stamp: string | null | undefined, nowMs: number = Date.now()): MarkLockState {
  if (!stamp) return { locked: false, minutesLeft: MARK_EDIT_WINDOW_MINUTES, notSetYet: true };

  const setAt = Date.parse(stamp);
  if (Number.isNaN(setAt)) {
    // Непонятная метка — не запираем: лучше пустить, чем молча запретить.
    return { locked: false, minutesLeft: MARK_EDIT_WINDOW_MINUTES, notSetYet: false };
  }

  const leftMs = setAt + MARK_EDIT_WINDOW_MINUTES * 60_000 - nowMs;
  if (leftMs <= 0) return { locked: true, minutesLeft: 0, notSetYet: false };
  return { locked: false, minutesLeft: Math.max(1, Math.ceil(leftMs / 60_000)), notSetYet: false };
}

/** Узнаёт отказ базы «запись заперта» среди прочих ошибок. */
export function isMarkLockedError(err: unknown): boolean {
  const raw =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : "";
  return /mark_locked/i.test(raw);
}
