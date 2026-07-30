"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Раньше AppShell.tsx решал "прятать каркас (сайдбар/топбар/паддинги)"
 * чисто по форме URL (/^\/lessons\/[^/]+/) — это матчило ВСЕ 3 состояния
 * урока (scheduled/in_progress/completed), а не только живой урок, хотя
 * задумывался только workspace (LessonWorkspaceView). PreLessonView и
 * завершённый LessonView из-за этого тоже теряли каркас без причины.
 *
 * AppShell не знает lesson.status — это серверные данные конкретной
 * страницы. Context — единственный способ дать глубоко вложенному
 * компоненту (LessonWorkspaceView) сказать общему каркасу-предку "спрячь
 * себя, пока я смонтирован", не проталкивая status через весь layout.
 */
const FullscreenLessonContext = createContext<{
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
} | null>(null);

export function FullscreenLessonProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <FullscreenLessonContext.Provider value={{ fullscreen, setFullscreen }}>
      {children}
    </FullscreenLessonContext.Provider>
  );
}

/** Читает AppShell.tsx вместо старой pathname-эвристики. */
export function useIsFullscreenLesson(): boolean {
  const ctx = useContext(FullscreenLessonContext);
  return ctx?.fullscreen ?? false;
}

/** Блок 2, Баг 3 — раньше вызывалась ТОЛЬКО из LessonWorkspaceView
 *  (ученик, живой урок) безусловно на весь маунт — учитель
 *  (TeacherLessonDetailView.tsx) не имел симметричной кнопки "Во весь
 *  экран" вообще (не оверсайт: комментарий выше явно называл это
 *  единственным нужным местом). Теперь принимает необязательный `enabled`
 *  (по умолчанию true — существующий вызов без аргумента у ученика ведёт
 *  себя ТОЧНО как раньше, безусловно). Учитель передаёт свой локальный
 *  `focusMode` — эффект пере-срабатывает на каждое изменение `enabled`,
 *  включая/выключая общий каркас (AppShell/TeacherShell — сайдбар/топбар
 *  приложения) по клику кнопки, а не один раз на монтировании. Снимается
 *  автоматически при размонтировании (переход на другую страницу). */
export function useRegisterFullscreenLesson(enabled: boolean = true): void {
  const ctx = useContext(FullscreenLessonContext);
  useEffect(() => {
    ctx?.setFullscreen(enabled);
    return () => ctx?.setFullscreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
