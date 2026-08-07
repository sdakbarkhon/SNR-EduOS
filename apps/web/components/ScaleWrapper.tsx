"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
 *
 * fitHeight (default true) — режим высоты обёртки:
 *   true  (каркасы /(app), /teacher): обёртка получает фиксированную
 *         height:calc(100vh/scale), html/body получают явную height:100vh +
 *         overflow-y:hidden. Рассчитано на каркасы с sticky/h-screen
 *         сайдбарами и фиксированной раскладкой "ровно один экран".
 *   false (/login): высота обёртки НЕ задаётся — растёт по контенту
 *         (auto), html/body/overflow-y не трогаются вовсе (родная
 *         прокрутка страницы работает как обычно). Нужен для вёрсток с
 *         абсолютным/fixed позиционированием (footer, языковой переключатель
 *         на /login) — принудительная height:100vh на body/html там уже
 *         один раз ломала раскладку (форма съезжала, футер наезжал), потому
 *         что дочерние min-h-screen считают 100vh от РЕАЛЬНОГО вьюпорта
 *         (единицы vh не масштабируются transform-ом предка), и при
 *         фиксированной высоте обёртки этот раздутый блок обрезался. Без
 *         фикс-высоты обёртка просто позволяет контенту (и его собственному
 *         min-h-screen) занять столько места, сколько ему нужно, с обычным
 *         вертикальным скроллом при необходимости — только ширина
 *         масштабируется.
 *   В обоих режимах overflow-x:hidden на html/body ставится всегда, пока
 *   active — иначе после scale() возможен горизонтальный скролл на пиксель-два
 *   из-за округления.
 */
export function ScaleWrapper({
  children,
  fitHeight = true,
}: {
  children: ReactNode;
  fitHeight?: boolean;
}) {
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
    const prevBodyHeight = document.body.style.height;
    const prevHtmlHeight = document.documentElement.style.height;
    const prevBodyOverflowX = document.body.style.overflowX;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    const prevBodyOverflowY = document.body.style.overflowY;
    const prevHtmlOverflowY = document.documentElement.style.overflowY;

    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";

    // Явная height:100vh + overflow-y:hidden — только в fitHeight-режиме
    // (см. комментарий выше класса). В fitHeight=false html/body остаются
    // нетронутыми — страница скроллится как обычная, немасштабированная.
    if (fitHeight) {
      document.body.style.height = "100vh";
      document.documentElement.style.height = "100vh";
      document.body.style.overflowY = "hidden";
      document.documentElement.style.overflowY = "hidden";
    }

    return () => {
      document.body.style.height = prevBodyHeight;
      document.documentElement.style.height = prevHtmlHeight;
      document.body.style.overflowX = prevBodyOverflowX;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
      document.body.style.overflowY = prevBodyOverflowY;
      document.documentElement.style.overflowY = prevHtmlOverflowY;
    };
  }, [fullscreen, active, fitHeight]);

  // Большой фикс — "React #310 ещё живёт на /schedule", раунд 2: живой
  // прод-репорт (eduos.snruz.uz/schedule, Yandex Browser) показал React
  // #418 (hydration mismatch) ПЕРЕД #310 — #310 там вторичный, каскадный
  // симптом провалившейся гидратации, а не самостоятельный баг порядка
  // хуков (полная статическая проверка кодовой базы дважды не нашла ни
  // одного нарушения Rules of Hooks). Раньше здесь было "if (fullscreen ||
  // !active) return <>{children}</>" — на сервере (нет window) active
  // ВСЕГДА false при первом рендере, значит структурно это должно совпадать
  // с первым клиентским рендером (эффект ещё не выполнился) — но ЛЮБОЕ
  // структурное ветвление Fragment↔div в компоненте, обёртывающем ВЕСЬ
  // remaining tree, — риск, которого не должно быть в принципе: теперь
  // ВСЕГДА рендерится один и тот же <div> (структура идентична между
  // сервером/клиентом при любом active), меняются только его style-значения
  // после эффекта — что является безопасным пост-гидратационным обновлением
  // стилей, а не структурным изменением DOM.
  // 07.08.2026 — фиксированный сайдбар. В неактивном состоянии (viewport
  // <=1920, то есть все обычные ноутбуки) обёртка не получала высоту вообще,
  // только margin:0. А каркасы /(app) и /teacher рассчитаны ровно наоборот:
  // их корневой div — `flex flex-1 min-h-0 overflow-hidden`, то есть он ждёт
  // высоту ОТ ЭТОГО flex-col родителя. Без неё высота считалась по контенту,
  // `overflow-hidden` не имел что обрезать, `overflow-y-auto` у <main> не имел
  // что скроллить — и скроллилась вся страница целиком вместе с сайдбаром.
  // Замерено на живой странице до правки: обёртка 1130px при вьюпорте 900,
  // сайдбар position:static высотой 1130, внутренних скроллеров ноль.
  //
  // height:100vh только при fitHeight — у /login он false, и там принудительная
  // высота уже один раз ломала раскладку (см. комментарий класса выше).
  // И только вне fullscreen-урока: там дочерний min-h-screen считает 100vh от
  // РЕАЛЬНОГО вьюпорта, и при фиксированной высоте обёртки обрезался бы — та
  // же ловушка, что описана для /login.
  const wrapperStyle: CSSProperties = fullscreen || !active
    ? { margin: 0, ...(fitHeight && !fullscreen ? { height: "100vh" } : {}) }
    : {
        width: `${BASE_WIDTH}px`,
        // fitHeight=true: обязательно /scale (не просто 100vh) —
        // transform:scale() масштабирует ОБЕ оси одинаково; деление на
        // scale — то, что делает пост-transform высоту снова ровно равной
        // 100vh. fitHeight=false: height вообще не задаётся — auto,
        // растёт по контенту (см. комментарий класса).
        ...(fitHeight ? { height: `calc(100vh / ${scale})` } : {}),
        margin: 0,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      };

  return (
    <div className="flex flex-col" style={wrapperStyle}>
      {children}
    </div>
  );
}
