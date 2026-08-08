"use client";

// 07.08.2026 — единый набор плагинов markdown для всех мест, где показывается
// текст от AI: слайды презентаций, описания этапов, ДЗ, проекты, AI-чат.
//
// Зачем отдельный модуль. Рендеров было три, и каждый собирал свой набор
// плагинов: MarkdownContent.tsx, SlideBody.tsx::Md и AiFloatingChat.tsx.
// Первые два знали только remark-gfm, третий — ещё и математику. Отсюда и
// симптом: в AI-чате формулы отрисовывались, а в слайде урока тот же текст
// показывал сырое `$x_0$`. Такое расхождение копий в этом проекте случалось
// уже трижды (резолв ссылок на материал, бакеты, фильтры), поэтому набор
// живёт в одном месте.
//
// Зависимости НЕ добавлялись: katex, remark-math и rehype-katex уже были в
// package.json и в lockfile — они стояли ради AI-чата, просто до остальных
// рендеров не доехали.

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// Стили формул подтягиваются один раз отсюда — раньше их импортировал только
// AiFloatingChat, поэтому даже подключи кто-то rehype-katex в слайдах,
// формулы остались бы неоформленными.
import "katex/dist/katex.min.css";

/** `$...$` в строке и `$$...$$` отдельным блоком. */
export const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMath];

/**
 * `throwOnError: false` — невалидная формула рисуется как исходный текст
 * (KaTeX подсвечивает её), а не роняет весь слайд. `strict: false` — не
 * ругаться на команды, которых KaTeX не знает: тексты пишет Gemini, и
 * гарантировать чистый TeX от него нельзя.
 */
export const MARKDOWN_REHYPE_PLUGINS = [
  [rehypeKatex, { throwOnError: false, strict: false }],
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 08.08.2026 — ИНЛАЙН-рендерер. Появился ради тестов: там текст вопроса и
// вариантов живёт внутри кнопок, центрированных заголовков и плиток
// фиксированной высоты (h-[72px] у Kahoot, min-h-[100px] у QuizChoiceTile).
// Блочный MarkdownContent там не годится — он оборачивает в
// <div class="prose"><p>, и вертикальные отступы абзаца разъезжают плитку.
//
// Живёт здесь, а не отдельным файлом, намеренно: набор плагинов в этом
// проекте уже разъезжался копиями четырежды (резолв ссылок на материал,
// бакеты, классификаторы файлов, сами markdown-плагины). Пятой копии не
// заводим — рендерер берёт ровно те же два массива, что объявлены выше.

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

/** Отличие от блочного рендера ровно одно: абзац не создаёт блок.
 *  Списки, таблицы и блоки кода остаются блочными — вопрос со списком
 *  должен выглядеть списком. */
const INLINE_COMPONENTS: Components = {
  p: ({ children }) => <>{children}</>,
  // Инлайн-код в тестах встречается ЧАЩЕ формул: на живых данных 84 варианта
  // ответа и 35 вопросов с обратными кавычками против 23–24 записей с $…$
  // (программирование против математики). Поэтому он получает явный вид, а
  // не наследует безликий <code> из prose, которого здесь всё равно нет.
  code: ({ className, children, ...props }) => {
    const isBlock = /language-(\w+)/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} block overflow-x-auto rounded-lg bg-black/80 p-3 font-mono text-[0.85em] text-slate-100`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-current/10 px-1 py-0.5 font-mono text-[0.9em] [color:inherit]" {...props}>
        {children}
      </code>
    );
  },
};

/** Разметка «в строку»: markdown и формулы работают, лишних отступов нет.
 *  Наследует цвет и размер шрифта от родителя — вставляется прямо туда, где
 *  раньше стоял голый {text}. */
export function MarkdownInline({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`[&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto ${className}`}>
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS as never}
        components={INLINE_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </span>
  );
}
