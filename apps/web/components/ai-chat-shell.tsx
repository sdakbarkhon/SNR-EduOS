"use client";

// 08.08.2026 — ОДИН внешний вид на оба чата помощника.
//
// Помощников в приложении два: общий (AiFloatingChat, страницы ученика) и
// урочный (lessons/[id]/AiChatPanel.tsx). Заказчик требует, чтобы они
// выглядели и вели себя один в один; единственная разница — урочный знает
// тему урока, класс и этап.
//
// Заход c1f4ef5 уже приводил их к одному виду копированием разметки — и они
// снова разъехались: у урочного осталось другое имя («Робокот» вместо «EduOS
// Assistant»), счётчик лимита стоял на месте строки «В сети», не было
// быстрых вопросов и подсветки кода в ответах, а кнопка помощника пропадала
// при раскрытии панели. Ровно тот же сценарий, что уже случался в этом
// проекте четырежды (резолв ссылок на материал, бакеты, классификаторы
// файлов, markdown-плагины): копии расходятся. Поэтому теперь разметка
// живёт здесь в одном экземпляре, а каждый чат приносит только СВОЮ начинку.
//
// Что НЕ переехало сюда и остаётся у каждого своим: транспорт (server action
// callAiChat против /api/ai/chat с lesson_id/stage_id и RAG-поиском по
// материалам), модель истории (sessionStorage против серверной), модель
// лимита (общий дневной /api/ai/usage против своего DAILY_LIMIT урока) и
// системные промты. Их сведение означало бы переписать обе логики — задача
// прямо запрещает трогать промты и запросы к Gemini.

import { useEffect, useRef, type RefObject } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import { Sparkles, Send, X } from "lucide-react";
import { MARKDOWN_REMARK_PLUGINS, MARKDOWN_REHYPE_PLUGINS } from "./markdown-plugins";
import { SyntaxHighlighter, oneDark } from "./lesson-stages/highlighter";

// function-plot (+ d3) — тяжёлая связка, нужна редко (только когда AI реально
// прислал ```chart), не должна попадать в основной бандл, который грузится на
// каждой странице ученика. ssr:false — function-plot трогает DOM напрямую.
const ChartBlock = dynamic(() => import("./ChartBlock").then((m) => m.ChartBlock), {
  ssr: false,
  loading: () => <div className="my-1 h-[200px] animate-pulse rounded-xl bg-slate-100" />,
});

/** Рендер тела ответа: ```chart уходит в ChartBlock, остальные языки — в
 *  подсвечиватель, инлайн-код не трогаем. Раньше это жило только в общем
 *  помощнике, из-за чего в уроке код в ответах шёл голым <code>. */
export const AI_MESSAGE_COMPONENTS: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    if (match?.[1] === "chart") {
      return <ChartBlock spec={String(children).replace(/\n$/, "")} />;
    }
    if (match) {
      return (
        <SyntaxHighlighter
          language={match[1]}
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: "0.75rem", fontSize: "0.9rem" }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export type AiChatShellMessage = {
  /** Стабильный ключ строки: id с сервера у урочного чата, индекс у общего. */
  key: string;
  role: "user" | "model";
  text: string;
};

export type AiChatUsage = { remaining: number; limit: number };

/** Цвет строки остатка. Пороги ДОЛЕВЫЕ, а не абсолютные: у общего помощника
 *  лимит в десятки раз больше урочного, и зашитые «<50 красный / <=100
 *  жёлтый» в уроке с лимитом 10 всегда давали бы красный. На лимите 500
 *  доли 10%/20% дают ровно прежние 50 и 100 — вид общего помощника не
 *  меняется. */
function usageToneClass({ remaining, limit }: AiChatUsage): string {
  const share = limit > 0 ? remaining / limit : 1;
  if (share < 0.1) return "text-red-300";
  if (share <= 0.2) return "text-yellow-300";
  return "text-white/85";
}

export function AiChatShell({
  title,
  statusLabel,
  usage,
  usageLabel,
  onClose,
  closeLabel,
  messages,
  loading,
  welcomeTitle,
  welcomeSubtitle,
  quickQuestions,
  onQuickQuestion,
  input,
  onInputChange,
  onSend,
  placeholder,
  inputRef,
  blockedNote,
}: {
  title: string;
  statusLabel: string;
  usage: AiChatUsage | null;
  /** Готовая подпись остатка — подставляет свои числа сам вызывающий. */
  usageLabel: string | null;
  onClose: () => void;
  closeLabel: string;
  messages: AiChatShellMessage[];
  loading: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  quickQuestions: readonly string[];
  onQuickQuestion: (q: string) => void;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** Не null → вместо поля ввода показывается эта подпись (лимит исчерпан). */
  blockedNote?: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] bg-white">
      {/* Шапка */}
      <div className="flex shrink-0 items-center gap-3 rounded-t-[20px] bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-3.5 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{title}</p>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {statusLabel}
          </p>
          {usage && usageLabel && (
            <p className={`mt-0.5 text-[11px] font-semibold opacity-85 ${usageToneClass(usage)}`}>
              {usageLabel}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Сообщения */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
        {messages.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div>
              <p className="text-sm font-bold text-slate-800">{welcomeTitle}</p>
              <p className="mt-1 max-w-[280px] text-xs text-slate-500">{welcomeSubtitle}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => onQuickQuestion(q)}
                  className="rounded-2xl bg-[#F7F5FF] px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-800 transition-colors hover:bg-[#EFE9FF]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.key} className="flex justify-end">
                  <div className="max-w-[82%] rounded-[16px] rounded-tr-md bg-gradient-to-br from-violet-500 to-indigo-600 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.key} className="flex items-end gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="max-w-[82%] rounded-[16px] rounded-tl-md bg-[#F3F1FB] px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700">
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden">
                      <ReactMarkdown
                        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                        rehypePlugins={MARKDOWN_REHYPE_PLUGINS as never}
                        components={AI_MESSAGE_COMPONENTS}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5 rounded-[16px] rounded-tl-md bg-[#F3F1FB] px-3.5 py-3.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Ввод */}
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-3 py-3">
        {blockedNote ? (
          <p className="w-full py-2 text-center text-xs text-slate-400">{blockedNote}</p>
        ) : (
          <>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl bg-[#F4F2FC] px-3.5 py-2.5 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
              style={{ maxHeight: "96px" }}
            />
            <button
              onClick={onSend}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
