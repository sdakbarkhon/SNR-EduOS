"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDictionary } from "@snr/core";
import type { Locale, LessonSlide } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

export function SlideViewer({
  slides,
  onExportPptx,
  canExport,
}: {
  slides: LessonSlide[];
  onExportPptx: () => void;
  canExport: boolean;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).lesson.slides;
  const [current, setCurrent] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(slides.length - 1, c + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length]);

  const slide = slides[current];
  if (!slide) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
      {/* Slide body */}
      <div className="flex-1 overflow-auto p-8 md:p-12">
        <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100 md:text-4xl">
          {slide.title}
        </h2>

        <div className="grid items-start gap-8 md:grid-cols-2">
          <div className="prose prose-slate max-w-none text-lg leading-relaxed dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide.content}</ReactMarkdown>
          </div>

          {slide.image_url && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image_url}
                alt={slide.title}
                className="h-auto max-w-full rounded-xl shadow-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-800">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{t.back}</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                aria-label={`${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === current ? "w-6 bg-violet-600" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
          <span className="ml-1 text-sm text-slate-500">
            {current + 1} {t.of} {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={onExportPptx}
              title={t.exportPptx}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))}
            disabled={current === slides.length - 1}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">{t.next}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
