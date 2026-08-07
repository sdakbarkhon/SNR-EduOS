"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { Bot, X, Send, Sparkles } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
// 07.08.2026 — тот же набор плагинов, что у остальных рендеров (коммит
// b2012ca). Раньше этот чат звал ReactMarkdown без плагинов вовсе, поэтому
// формулы и GFM-разметка в ответах помощника внутри урока не работали, хотя
// в общем помощнике работали.
import { MARKDOWN_REMARK_PLUGINS, MARKDOWN_REHYPE_PLUGINS } from "@/components/markdown-plugins";

const DAILY_LIMIT = 10;
const OPEN_KEY = "ai_chat_open";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AiChatPanel({
  lessonId,
  stageId,
}: {
  lessonId: string;
  stageId?: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.ai.chat;

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(OPEN_KEY) === "1";
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history on open
  useEffect(() => {
    if (!open || historyLoaded) return;
    fetch(`/api/ai/chat/history?lesson_id=${lessonId}`)
      .then((r) => r.json())
      .then((data: { messages: Array<{ id: string; role: string; content: string }>; remaining: number }) => {
        if (Array.isArray(data.messages)) {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          );
        }
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        setHistoryLoaded(true);
      })
      .catch(() => { setHistoryLoaded(true); });
  }, [open, historyLoaded, lessonId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist open state
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || remaining <= 0) return;

    const optimisticId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          stage_id: stageId ?? null,
          user_message: text,
        }),
      });

      const data = (await res.json()) as { text?: string; remaining?: number; error?: string };

      if (res.status === 429) {
        setRemaining(0);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: t.limitReached },
        ]);
        return;
      }

      if (!res.ok || data.error || !data.text) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: t.error },
        ]);
        return;
      }

      if (typeof data.remaining === "number") setRemaining(data.remaining);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.text! },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: t.error },
      ]);
    } finally {
      setLoading(false);
      // Re-focus input after send
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, remaining, lessonId, stageId, t]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  const remainingLabel = t.remaining
    .replace("{n}", String(remaining))
    .replace("{total}", String(DAILY_LIMIT));

  // ── Collapsed state: floating button ────────────────────────────────────────
  //
  // 07.08.2026 — кнопка приведена к общей: та же иконка Sparkles, тот же
  // оранжево-жёлтый градиент, размер и положение, что у AiFloatingButton на
  // остальных страницах. Раньше здесь был синий робот 56×56 в другом углу, и
  // ученик видел в уроке «другого» помощника. Почему компоненты вообще
  // разные — см. комментарий к панели ниже.
  if (!open) {
    return createPortal(
      <button
        onClick={toggle}
        title={t.expand}
        aria-label={t.expand}
        className="fixed bottom-20 right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-400 shadow-lg transition-transform hover:scale-105 hover:shadow-xl md:bottom-4"
      >
        <Sparkles className="h-6 w-6 text-white" strokeWidth={2} />
      </button>,
      document.body,
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────────
  const isEmpty = !loading && messages.length === 0 && historyLoaded;

  // 07.08.2026 — геометрия и оформление панели приведены к общему помощнику
  // (components/AiFloatingButton.tsx + AiFloatingChat.tsx): плавающая карточка
  // ~400×600 над кнопкой в правом нижнем углу вместо боковой полосы 320px во
  // всю высоту экрана.
  //
  // Почему компоненты остаются РАЗНЫМИ. Различие не косметическое: этот чат
  // ходит в /api/ai/chat с lesson_id/stage_id (контекст урока + RAG-поиск по
  // материалам), историю держит на сервере (/api/ai/chat/history) и считает
  // дневной лимит; общий помощник шлёт server action callAiChat без контекста
  // и хранит историю в sessionStorage. Это два разных транспорта, две модели
  // истории и две модели лимита — сведение в один компонент означало бы
  // переписать обе, что заметно больше задачи «сделать одинаково». Поэтому
  // унифицирован ВИД и поведение, а начинка урок-чата сохранена целиком.
  return createPortal(
    <div
      className="fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] md:bottom-20"
      style={{ height: "min(600px, calc(100vh - 180px))" }}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl ring-1 ring-black/5 dark:bg-slate-900">
        {/* Шапка — градиентная полоса, как у общего помощника. Строка остатка
            лимита оставлена: у урок-чата лимит свой (DAILY_LIMIT), и без неё
            ученик не поймёт, почему помощник вдруг перестал отвечать. */}
        <div className="flex shrink-0 items-center gap-3 rounded-t-[20px] bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-3.5 text-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{t.title}</p>
            <p className="text-[11px] font-semibold text-white/85">{remainingLabel}</p>
          </div>
          <button
            onClick={toggle}
            title={t.collapse}
            aria-label={t.collapse}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
          {isEmpty && (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.title}</p>
              <p className="max-w-[280px] text-xs text-slate-500 dark:text-slate-400">
                {t.welcomeMessage}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "items-end gap-2"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-[16px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-md bg-gradient-to-br from-violet-500 to-indigo-600 font-medium text-white shadow-sm"
                    : "rounded-tl-md bg-[#F3F1FB] text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden">
                    <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} rehypePlugins={MARKDOWN_REHYPE_PLUGINS as never}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                <Bot className="h-3.5 w-3.5" />
              </div>
              {/* Три точки вместо спиннера — как в общем помощнике. */}
              <div className="flex items-center gap-1.5 rounded-[16px] rounded-tl-md bg-[#F3F1FB] px-3.5 py-3.5 dark:bg-slate-800">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 px-3 py-3 dark:border-slate-700">
          {remaining <= 0 ? (
            <p className="py-2 text-center text-xs text-slate-400">{t.limitReached}</p>
          ) : (
            <div className="flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t.placeholder}
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl bg-[#F4F2FC] px-3.5 py-2.5 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
                style={{ maxHeight: "96px" }}
              />
              <button
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
                title={t.send}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
