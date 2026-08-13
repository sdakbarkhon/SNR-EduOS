import { schoolNowFrom, isSchoolFrozen } from "@snr/core";

/**
 * «Сейчас» глазами школы — для мобильного приложения.
 *
 * БЫЛО (до 13.08.2026): дата заморозки лежала в приложении тремя копиями —
 * `app.json → extra.frozenDate`, хардкод-фолбэк прямо здесь и мок расписания.
 * Приложение считало себя замороженным всегда (`isFrozen()` возвращала true),
 * поэтому родителю обычной школы показало бы 29 июля 2026 года.
 *
 * СТАЛО: источник один — колонка `schools.frozen_date`. Правило общее с вебом
 * и лежит в `@snr/core/utils/schoolTime`: пусто — время настоящее, заполнено —
 * якорь на этой дате. Своей константы здесь больше нет.
 *
 * ПОЧЕМУ КЭШ В МОДУЛЕ, А НЕ КОНТЕКСТ. `getAppNow()` зовут из мест, где хука
 * нет и быть не может: `lib/tashkent.ts` (чистые функции) и
 * `hooks/useTashkentToday.ts` (внутри setTimeout). Переписать их на контекст
 * значило бы протащить провайдер через весь слой утилит ради одного значения.
 * Поэтому значение кладётся сюда один раз при загрузке данных родителя
 * (`ParentDataContext`), а читатели остаются синхронными, как были.
 *
 * ПОКА НЕ ЗАГРУЖЕНО — отдаём настоящее время. Для школы без заморозки это и
 * есть верный ответ навсегда; для замороженной — на те доли секунды, что идёт
 * первый запрос. Чтобы эти доли секунды не остались на экране, тут же есть
 * подписка: `useTashkentToday` пересчитывает день, как только дата школы
 * приехала (см. subscribeSchoolTime ниже).
 */

/** undefined — ещё не загружали; null — школа без заморозки; строка — дата. */
let frozenDate: string | null | undefined = undefined;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Вызывается один раз после загрузки школы. Повторный вызов с тем же
 *  значением слушателей не будит — лишние перерисовки ни к чему. */
export function setSchoolFrozenDate(next: string | null): void {
  if (frozenDate !== undefined && frozenDate === next) return;
  frozenDate = next;
  listeners.forEach((fn) => fn());
}

/** Подписка на момент, когда дата школы стала известна или изменилась. */
export function subscribeSchoolTime(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Загружена ли уже дата школы. Нужно экранам, которые иначе показали бы
 *  «сегодня» настоящего дня и через мгновение сменили его на школьный. */
export function isSchoolTimeReady(): boolean {
  return frozenDate !== undefined;
}

export function getAppNow(): Date {
  return schoolNowFrom(frozenDate ?? null);
}

export function getAppNowMs(): number {
  return getAppNow().getTime();
}

/** Заморожена ли школа. До загрузки — false: врать про заморозку хуже, чем
 *  сказать «время настоящее» и уточнить через мгновение. */
export function isFrozen(): boolean {
  return isSchoolFrozen(frozenDate ?? null);
}
