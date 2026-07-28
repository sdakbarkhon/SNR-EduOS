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

/** Вызывается ТОЛЬКО из LessonWorkspaceView (живой урок, status="in_progress")
 *  — единственное место, где нужен fullscreen. Снимается автоматически при
 *  размонтировании (переход в completed/scheduled или уход со страницы). */
export function useRegisterFullscreenLesson(): void {
  const ctx = useContext(FullscreenLessonContext);
  useEffect(() => {
    ctx?.setFullscreen(true);
    return () => ctx?.setFullscreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
