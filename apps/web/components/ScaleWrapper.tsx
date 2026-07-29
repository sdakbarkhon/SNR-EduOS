"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useIsFullscreenLesson } from "./fullscreen-lesson-context";

const BASE_WIDTH = 1920;

/**
 * ScaleWrapper активен ТОЛЬКО когда реальный viewport ШИРЕ 1920px — тогда
 * логический холст 1920px растягивается transform: scale() под физический
 * монитор (2560/3440/3840...). На <=1920 (включая ровно 1920×1080/1920×1200
 * и любые ноутбучные 1366/1440/1536) компонент — полный no-op: рендерит
 * children напрямую, без обёртки, без width/transform — так, будто
 * ScaleWrapper вообще не существует.
 *
 * Раньше "выключенное" состояние всё равно рисовало literal
 * width:1920px div (scale прижимался к 1 через Math.max) — этот div мог
 * быть шире реально доступного пространства (скроллбар, оконный хром) и
 * обрезался. Теперь на <=1920 такой обёртки просто нет физически — это
 * устраняет саму возможность подобной обрезки, а не маскирует её.
 *
 * transform на обёртке заодно делает её containing block для потомков с
 * position:fixed (по спеке CSS) — но это работает только пока active=true;
 * на <=1920 DemoBanner/BottomNav/AiFloatingButton позиционируются
 * относительно реального окна как обычно (естественная часть no-op).
 *
 * Fullscreen-урок (LessonWorkspaceView, см. fullscreen-lesson-context.tsx) —
 * исключение независимо от ширины: пока он смонтирован, всегда no-op.
 */
export function ScaleWrapper({ children }: { children: ReactNode }) {
  const fullscreen = useIsFullscreenLesson();
  const [scale, setScale] = useState(1);
  const [active, setActive] = useState(false);

  useEffect(() => {
    function recompute() {
      const w = window.innerWidth;
      if (w > BASE_WIDTH) {
        setScale(w / BASE_WIDTH);
        setActive(true);
      } else {
        setScale(1);
        setActive(false);
      }
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  useEffect(() => {
    if (fullscreen || !active) return;
    // html/body получают явную height:100vh + overflow-y:hidden, ПОКА
    // active=true. Это отдельная, независимая гарантия от высоты самой
    // обёртки ниже: transform НЕ меняет layout-размер элемента (только
    // то, как он рисуется) — обёртка занимает в потоке документа ровно
    // calc(100vh/scale) логических пикселей, даже когда после transform
    // визуально растягивается обратно до 100vh. Если бы html/body не
    // получали свою собственную высоту явно, их auto-высота считалась бы
    // от ЭТОГО layout-размера (короче реального viewport), и фон
    // страницы под настоящим низом экрана не был бы прокрашен — именно
    // это выглядело как пустое поле снизу на широких мониторах.
    // Заодно overflow-y:hidden — никакого вертикального скролла: обёртка
    // и так после transform ровно 100vh, скроллить нечего.
    const prevBodyHeight = document.body.style.height;
    const prevHtmlHeight = document.documentElement.style.height;
    const prevBodyOverflowX = document.body.style.overflowX;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    const prevBodyOverflowY = document.body.style.overflowY;
    const prevHtmlOverflowY = document.documentElement.style.overflowY;
    document.body.style.height = "100vh";
    document.documentElement.style.height = "100vh";
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";
    return () => {
      document.body.style.height = prevBodyHeight;
      document.documentElement.style.height = prevHtmlHeight;
      document.body.style.overflowX = prevBodyOverflowX;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
      document.body.style.overflowY = prevBodyOverflowY;
      document.documentElement.style.overflowY = prevHtmlOverflowY;
    };
  }, [fullscreen, active]);

  if (fullscreen || !active) return <>{children}</>;

  return (
    <div
      className="flex flex-col"
      style={{
        width: `${BASE_WIDTH}px`,
        // Обязательно /scale (не просто 100vh) — transform:scale() масштабирует
        // ОБЕ оси одинаково. Если бы высота была полным 100vh (без деления),
        // после того же transform она стала бы 100vh*scale — заметно больше
        // реального экрана (обрезка/скролл снизу). Деление на scale — то, что
        // делает пост-transform высоту снова ровно равной 100vh.
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
