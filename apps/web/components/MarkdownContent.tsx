"use client";

import ReactMarkdown from "react-markdown";
import { markdownCodeComponents } from "./lesson-stages/markdownCode";
import { MARKDOWN_REMARK_PLUGINS, MARKDOWN_REHYPE_PLUGINS } from "./markdown-plugins";

// Общий рендерер для длинных описательных текстов (проекты, ДЗ, этапы
// уроков) — те же react-markdown + remark-gfm + markdownCodeComponents,
// что уже использует SlideBody.tsx для слайдов, только без привязки к
// фиксированному 16:9-кадру слайда. "prose" классы требуют
// @tailwindcss/typography (зарегистрирован в tailwind.config.ts).
export function MarkdownContent({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`prose prose-slate max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS as never}
        components={markdownCodeComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
