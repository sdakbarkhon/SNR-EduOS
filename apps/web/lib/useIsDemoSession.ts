"use client";

import { useSyncExternalStore } from "react";
import { DEMO_SESSION_COOKIE } from "./single-session";

// PROMT 3 демо-защита: демо-сессия может СОЗДАВАТЬ записи, но не может
// редактировать/удалять существующие РЕАЛЬНЫЕ (is_demo=false). Хук читает
// НЕ-httpOnly куку snr-demo-session (ставится server action'ом demoLogin) —
// компоненты дизейблят кнопки «Изменить»/«Удалить»/«Оценить» на реальных
// записях. Это только UX-слой: жёсткий запрет живёт в БД-триггере
// fn_stamp_is_demo (ошибка editing_real_data_in_demo, миграция 110).

function readCookie(): boolean {
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${DEMO_SESSION_COOKIE}=`));
}

// Кука меняется только через полный логин/логаут (navigation) — подписка
// на изменения не нужна, но useSyncExternalStore даёт корректный SSR-фолбэк
// (false на сервере, без hydration mismatch: до маунта сервер и клиент
// согласованно рендерят "не демо", после подписки клиент дочитывает куку).
const subscribe = () => () => {};

export function useIsDemoSession(): boolean {
  return useSyncExternalStore(subscribe, readCookie, () => false);
}

/**
 * true = текущая демо-сессия НЕ имеет права менять эту запись (она реальная).
 * Для не-демо сессий всегда false. Удобство для `disabled={...}` на
 * компонентах, куда ВСЕГДА приходит уже существующая запись (правка/удаление
 * материала, этапа урока и т.п. — не upsert-формы).
 *
 * Для upsert-форм, где записи может ещё не быть (оценка/посещаемость/сабмишен
 * выставляются впервые — это создание, не правка, и разрешено всегда),
 * НЕ используйте этот хук с `record?.is_demo` — `undefined !== true` даёт
 * `true` и заблокирует создание. Вместо этого считайте на месте:
 * `useIsDemoSession() && existing != null && !existing.is_demo`.
 */
export function useDemoEditBlocked(recordIsDemo: boolean): boolean {
  const isDemoSession = useIsDemoSession();
  return isDemoSession && !recordIsDemo;
}

/**
 * UI-хук может не успеть задизейблить кнопку (устаревшие данные на экране,
 * race между двумя вкладками) — тогда запрос доходит до БД и падает на
 * триггере fn_stamp_is_demo с текстом 'editing_real_data_in_demo' (миграция
 * 110). Эта функция распознаёт такую ошибку в supabase-js error-объекте,
 * чтобы показать d.cannotEditRealData вместо сырого текста Postgres.
 */
export function isDemoEditBlockedError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? String(error ?? "");
  return message.includes("editing_real_data_in_demo");
}
