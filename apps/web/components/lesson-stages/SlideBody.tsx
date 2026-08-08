"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Image as ImageIcon, Quote as QuoteIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { MARKDOWN_REMARK_PLUGINS, MARKDOWN_REHYPE_PLUGINS } from "@/components/markdown-plugins";
import { MarkdownInline } from "@/components/markdown-plugins";
import type { LessonSlide } from "@snr/core";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { markdownCodeComponents } from "./markdownCode";
import { SyntaxHighlighter, oneDark } from "./highlighter";

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={MARKDOWN_REMARK_PLUGINS}
      rehypePlugins={MARKDOWN_REHYPE_PLUGINS as never}
      components={markdownCodeComponents}
    >
      {children}
    </ReactMarkdown>
  );
}

const LAYOUT_BG: Record<string, string> = {
  title: "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800",
  quote: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900",
  code: "bg-slate-900",
  split: "bg-white dark:bg-slate-900",
  default: "bg-white dark:bg-slate-900",
};

// Inner content, natural (unscaled) size — the outer <SlideBody> wrapper
// measures this against the fixed 16:9 frame and scales it down to fit.
function SlideContent({ slide, current, total, stageImageUrl }: { slide: LessonSlide; current: number; total: number; stageImageUrl?: string | null }) {
  const layout = slide.layout ?? "default";

  if (layout === "title") {
    return (
      <div className="relative flex flex-col items-center p-16 text-white">
        <h1 className="mb-8 text-center text-4xl font-bold leading-tight md:text-6xl">{slide.title}</h1>
        {slide.content && (
          <p className="max-w-3xl text-center text-lg text-white/80 md:text-2xl">{slide.content}</p>
        )}
        <div className="absolute bottom-0 right-0 text-sm text-white/40">
          {current + 1} / {total}
        </div>
      </div>
    );
  }

  if (layout === "quote") {
    return (
      <div className="flex flex-col items-center p-16">
        <QuoteIcon className="mb-8 h-16 w-16 text-violet-400" />
        <blockquote className="max-w-4xl text-center text-2xl font-light italic leading-relaxed text-slate-800 dark:text-slate-100 md:text-4xl">
          &ldquo;{slide.quote?.text ?? slide.content}&rdquo;
        </blockquote>
        {slide.quote?.author && (
          <p className="mt-8 text-lg text-slate-500 dark:text-slate-400 md:text-xl">— {slide.quote.author}</p>
        )}
      </div>
    );
  }

  if (layout === "code" && slide.code) {
    return (
      <div className="grid w-full grid-cols-1 gap-6 p-8 md:grid-cols-2 md:gap-8 md:p-12">
        <div className="flex flex-col justify-center text-white">
          <h2 className="mb-4 text-2xl font-bold md:text-4xl">{slide.title}</h2>
          <div className="prose prose-invert max-w-none text-base leading-relaxed md:text-lg">
            <Md>{slide.content}</Md>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl shadow-2xl">
          <SyntaxHighlighter
            language={slide.code.language}
            style={oneDark}
            customStyle={{ margin: 0, padding: "1.5rem", fontSize: "0.9rem" }}
          >
            {slide.code.content}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="grid w-full grid-cols-1 gap-6 p-8 md:grid-cols-2 md:gap-8 md:p-12">
        <div className="flex flex-col justify-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-4xl">{slide.title}</h2>
          <div className="prose prose-slate max-w-none text-base leading-relaxed dark:prose-invert md:text-lg">
            <Md>{slide.content}</Md>
          </div>
        </div>
        <div className="flex items-center justify-center">
          {slide.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.image_url}
              alt={slide.title}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/10 dark:to-purple-500/10">
              <ImageIcon className="h-16 w-16 text-violet-400" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // default
  const Icon = slide.icon ? LUCIDE_ICONS[slide.icon] : undefined;
  // 08.08.2026 — картинка этапа встаёт ВНУТРЬ слайда, справа от текста.
  // Раньше StageMedia рисовал её отдельным блоком НАД слайдом, и на экране
  // получались два несвязанных куска: картинка, потом отдельно слайд с
  // текстом. На узких экранах колонка уезжает под текст (grid-cols-1 до lg).
  //
  // Картинка ЭТАПА рисуется только на ПЕРВОМ слайде: она одна на весь этап,
  // а слайдов бывает шесть, и раньше одна и та же картинка повторялась на
  // каждом — выглядело как ошибка вёрстки. Своя картинка слайда
  // (slide.image_url, макет "split") приоритетнее и показывается на своём
  // слайде независимо от его номера.
  const asideImage = slide.image_url ?? (current === 0 ? stageImageUrl ?? null : null);
  return (
    <div className="w-full p-8 md:p-12">
      <div className="mb-6 flex items-center gap-3">
        {Icon && <Icon className="h-8 w-8 shrink-0 text-violet-500 md:h-10 md:w-10" />}
        <h2
          className={`inline-block border-b-4 border-violet-500 pb-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-4xl ${
            slide.title_font === "fancy" ? "font-serif" : ""
          }`}
        >
          {slide.title}
        </h2>
      </div>
      <div className={asideImage ? "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-10" : ""}>
        <div className="prose prose-slate max-w-none text-base leading-relaxed dark:prose-invert md:text-lg">
          <Md>{slide.content}</Md>
        </div>
        {asideImage && (
          // 08.08.2026 — высота ограничена. Без max-h картинка занимала
          // столько, сколько давал её собственный размер, слайд становился
          // вдвое выше, и авто-масштаб дожимал остальное: на слайде с
          // мини-опросом четвёртый вариант ответа уходил за нижний край
          // кадра. Ширина колонки и так задана сеткой, высоту ограничиваем
          // отдельно — object-contain сохраняет пропорции.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asideImage}
            alt=""
            className="mx-auto max-h-[300px] w-full rounded-2xl border border-slate-200 object-contain shadow-sm dark:border-slate-700"
          />
        )}
      </div>
    </div>
  );
}

// Раньше был 0.7 (70%) — контент, который не влезал даже при таком
// масштабе (например, крупный заголовок title-слайда с длинным текстом
// ниже), обрезался по краям overflow-hidden рамки (transform-origin:
// center режет одинаково сверху и снизу). Обрезанный текст читать
// невозможно — мелкий, но целиком видимый текст всегда лучше. Понижен
// до 0.2 — практически гарантирует полное умещение при сохранении
// защиты от вырожденного near-zero масштаба на патологически длинном
// контенте.
const MIN_SCALE = 0.2;

/** Fixed 16:9 frame + auto-scale-to-fit: slide content renders at its
 *  natural size inside `inner`, then gets scaled down (never up) so it
 *  always fits within the frame without requiring scroll — clamped to
 *  MIN_SCALE (20%, see comment above) as a floor against pathological
 *  content, not as a "prefer cropping over shrinking" trade-off. */
export function SlideBody({ slide, current, total, stageImageUrl }: { slide: LessonSlide; current: number; total: number; stageImageUrl?: string | null }) {
  const layout = slide.layout ?? "default";
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      inner.style.transform = "scale(1)";
      const outerRect = outer.getBoundingClientRect();
      const innerRect = inner.getBoundingClientRect();
      if (innerRect.height === 0 || innerRect.width === 0 || outerRect.height === 0) return;
      const next = Math.min(1, outerRect.height / innerRect.height, outerRect.width / innerRect.width);
      setScale(Math.max(MIN_SCALE, next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);

    // 08.08.2026 — пересчёт после загрузки картинки. До загрузки <img> имеет
    // нулевую высоту, масштаб считался по «слайду без картинки» и оставался
    // единицей; когда картинка приходила, содержимое становилось выше кадра
    // и низ (мини-опрос) обрезался рамкой с overflow-hidden. Событие load у
    // картинок НЕ всплывает — ловим его на фазе перехвата.
    const onLoad = (e: Event) => { if ((e.target as HTMLElement)?.tagName === "IMG") measure(); };
    inner.addEventListener("load", onLoad, true);

    return () => {
      ro.disconnect();
      inner.removeEventListener("load", onLoad, true);
    };
  }, [slide]);

  return (
    <div
      ref={outerRef}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${LAYOUT_BG[layout]}`}
      style={slide.background_color ? { backgroundColor: slide.background_color } : undefined}
    >
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: "center" }} className="w-full">
        <SlideContent slide={slide} current={current} total={total} stageImageUrl={stageImageUrl} />
      </div>
    </div>
  );
}
