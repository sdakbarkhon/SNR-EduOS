"use client";

import { useCallback, useRef } from "react";

/**
 * Z.2.9 — защита от двойной отправки формы.
 *
 * Кнопки в админке и так гаснут по `isPending` из `useTransition`, но между
 * кликом и перерисовкой есть окно: обработчик уже начал работу, а атрибут
 * `disabled` ещё не проставлен. Быстрый двойной клик (и нетерпеливый двойной
 * тап на телефоне) успевает пройти дважды — и создаются две записи.
 *
 * Здесь блокировка живёт в ref, а не в состоянии: она встаёт в тот же тик,
 * что и первый вызов, до всякого рендера. Снимается, когда переданная
 * функция завершилась — успехом или ошибкой, иначе форма залипла бы после
 * первой же неудачи.
 *
 * Идемпотентные действия (редактирование, переключатели) в этом не нуждаются
 * — повтор там ничего не портит; оборачиваем только создание.
 */
export function useSubmitGuard(): (fn: () => void | Promise<void>) => void {
  const busy = useRef(false);

  return useCallback((fn: () => void | Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    let released = false;
    const release = () => {
      if (!released) { released = true; busy.current = false; }
    };
    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).finally === "function") {
        void (result as Promise<void>).finally(release);
      } else {
        release();
      }
    } catch {
      release();
      throw new Error("submit failed");
    }
  }, []);
}
