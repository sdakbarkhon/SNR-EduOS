import { Image as ImageIcon, Quote as QuoteIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LessonSlide } from "@snr/core";
import { markdownCodeComponents } from "./markdownCode";
import { SyntaxHighlighter, oneDark } from "./highlighter";

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownCodeComponents}>
      {children}
    </ReactMarkdown>
  );
}

export function SlideBody({ slide, current, total }: { slide: LessonSlide; current: number; total: number }) {
  const layout = slide.layout ?? "default";

  if (layout === "title") {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800 p-16 text-white">
        <h1 className="mb-8 text-center text-4xl font-bold leading-tight md:text-6xl">{slide.title}</h1>
        {slide.content && (
          <p className="max-w-3xl text-center text-lg text-white/80 md:text-2xl">{slide.content}</p>
        )}
        <div className="absolute bottom-8 right-8 text-sm text-white/40">
          {current + 1} / {total}
        </div>
      </div>
    );
  }

  if (layout === "quote") {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-16 dark:from-slate-800 dark:to-slate-900">
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
      <div className="grid h-full grid-cols-1 gap-6 bg-slate-900 p-8 md:grid-cols-2 md:gap-8 md:p-12">
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
            customStyle={{ margin: 0, padding: "1.5rem", fontSize: "0.9rem", height: "100%" }}
          >
            {slide.code.content}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="grid h-full grid-cols-1 gap-6 bg-white p-8 dark:bg-slate-900 md:grid-cols-2 md:gap-8 md:p-12">
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
  return (
    <div className="flex h-full flex-col bg-white p-8 dark:bg-slate-900 md:p-12">
      <h2 className="mb-6 inline-block border-b-4 border-violet-500 pb-3 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-4xl">
        {slide.title}
      </h2>
      <div className="prose prose-slate max-w-none flex-1 text-base leading-relaxed dark:prose-invert md:text-lg">
        <Md>{slide.content}</Md>
      </div>
    </div>
  );
}
