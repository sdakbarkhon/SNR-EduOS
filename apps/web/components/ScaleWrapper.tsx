"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useIsFullscreenLesson } from "./fullscreen-lesson-context";

const BASE_WIDTH = 1920;

/**
 * Приложение всегда рендерится в логическом холсте 1920×N (N = 100vh/scale) —
 * Tailwind-брейкпоинты внутри не переключаются на бОльших мониторах (кроме
 * тех немногих, что уже сейчас триггерятся выше 1920px реального viewport —
 * их в шелле не осталось). Холст визуально растягивается/сжимается
 * transform: scale() под РЕАЛЬНУЮ доступную ширину — раньше здесь стоял
 * Math.max(1, ...), т.е. scale никогда не опускался ниже 1: на ЛЮБОМ
 * реальном viewport <1920 (обычный ноутбук 1366/1440/1536, любой монитор
 * ровно 1920 минус ~15-17px на вертикальный скроллбар) холст всё равно
 * рендерился буквально в 1920px и обрезался — это и была причина "правый
 * край режется" на 1920-мониторе, а не нехватка логической ширины макета
 * (грид учительского/ученического дашборда — везде fr-based/fluid, жёстких
 * px-минимумов на 1920-230(сайдбар)=1690px не найдено). Теперь scale — это
 * просто реальное отношение без клампа: <1920 холст пропорционально
 * УМЕНЬШАЕТСЯ (без обрезки, но чуть мельче), >=1920 — увеличивается, как и
 * раньше. clientWidth (не innerWidth) — не включает ширину вертикального
 * скроллбара, иначе тот же зазор в ~15px остался бы даже без клампа.
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
      // clientWidth, не innerWidth — исключает ширину вертикального
      // скроллбара (обычно ~15-17px), которую innerWidth включает в себя,
      // но которая фактически не доступна для контента.
      setScale(document.documentElement.clientWidth / BASE_WIDTH);
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
