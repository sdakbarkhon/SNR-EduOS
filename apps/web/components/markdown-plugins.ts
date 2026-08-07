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
