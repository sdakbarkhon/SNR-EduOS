"use client";

import { useSyncExternalStore } from "react";
import { DEMO_SESSION_COOKIE } from "./single-session";

// P2: демо-сессия — это вход в РЕАЛЬНЫЙ аккаунт из общего пула + жёлтый
// баннер сверху. Больше нет фонового триггера fn_stamp_is_demo (снесён
// миграцией 132), поэтому демо-сессия может редактировать те же реальные
// данные, что и обычный пользователь того аккаунта. Хук useIsDemoSession
// живёт для баннера и (опционально) для UI-подсказок; жёсткие блокировки
// UPDATE/DELETE от нашей стороны больше не нужны.

function readCookie(): boolean {
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${DEMO_SESSION_COOKIE}=`));
}

const subscribe = () => () => {};

export function useIsDemoSession(): boolean {
  return useSyncExternalStore(subscribe, readCookie, () => false);
}

/**
 * P2: в новой модели демо-сессия правит РЕАЛЬНЫЕ данные — эта функция
 * всегда возвращает false. Оставлена как совместимый no-op, чтобы не
 * править ~10 вызывающих компонентов одним патчем; callers постепенно
 * зачищаются в последующих коммитах.
 */
export function useDemoEditBlocked(_recordIsDemo: boolean | null | undefined): boolean {
  return false;
}

/**
 * P2: триггер fn_stamp_is_demo (миграция 110) удалён миграцией 132 —
 * ошибка 'editing_real_data_in_demo' больше НЕ возникает. Функция
 * возвращает false и остаётся как совместимый no-op для callers.
 */
export function isDemoEditBlockedError(_error: unknown): boolean {
  return false;
}
