"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useIsFullscreenLesson } from "./fullscreen-lesson-context";

const BASE_WIDTH = 1920;

/**
 * Приложение всегда рендерится в логическом холсте 1920×N (N = 100vh/scale) —
 * Tailwind-брейкпоинты внутри не переключаются на бОльших мониторах (кроме
 * тех немногих, что уже сейчас триггерятся выше 1920px реального viewport —
 * их в шелле не осталось). На физическом viewport >= 1920 холст визуально
 * растягивается transform: scale() до полной ширины монитора; ниже 1920 —
 * scale=1, поведение не отличается от простого w-full.
 *
 * transform на этом контейнере заодно делает его containing block для
 * потомков с position:fixed (по спеке CSS — transform у предка "ловит"
 * fixed-позиционирование так же, как relative ловит absolute) — поэтому
 * DemoBanner/BottomNav/AiFloatingButton не нуждаются в отдельных 1920-хаках:
 * они естественно позиционируются относительно этого же холста, а не
 * реального окна.
 *
 * Fullscreen-урок (LessonWorkspaceView, см. fullscreen-lesson-context.tsx) —
 * единственное исключение: пока он смонтирован, useIsFullscreenLesson()
 * истинно и обёртка становится прозрачным no-op — урок получает весь
 * физический экран без масштаба, как и раньше.
 */
export function ScaleWrapper({ children }: { children: ReactNode }) {
  const fullscreen = useIsFullscreenLesson();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function recompute() {
      setScale(Math.max(1, window.innerWidth / BASE_WIDTH));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  useEffect(() => {
    if (fullscreen) return;
    // overflow-x на ОБОИХ html и body — Safari в части версий игнорирует
    // overflow-x:hidden на body одном, если не задать его и на html тоже.
    const prevBodyOverflowX = document.body.style.overflowX;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
    return () => {
      document.body.style.overflowX = prevBodyOverflowX;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
    };
  }, [fullscreen]);

  if (fullscreen) return <>{children}</>;

  return (
    <div
      className="flex flex-col"
      style={{
        width: `${BASE_WIDTH}px`,
        height: `calc(100vh / ${scale})`,
        margin: 0,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {children}
    </div>
  );
}
