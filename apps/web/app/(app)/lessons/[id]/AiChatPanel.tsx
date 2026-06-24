"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

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
  if (!open) {
    return createPortal(
      <button
        onClick={toggle}
        title={t.expand}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg transition hover:shadow-xl hover:scale-105 active:scale-95"
      >
        <Bot className="h-6 w-6" />
      </button>,
      document.body,
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────────
  const isEmpty = !loading && messages.length === 0 && historyLoaded;

  return createPortal(
    <div
      className="fixed bottom-0 right-0 top-0 z-50 flex flex-col"
      style={{ width: 320 }}
    >
      {/* Semi-transparent backdrop strip (decorative, not blocking) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-none border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{remainingLabel}</p>
            </div>
          </div>
          <button
            onClick={toggle}
            title={t.collapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {isEmpty && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-slate-800">
                <Bot className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                {t.welcomeMessage}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-1.5 mt-0.5 flex-shrink-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <Bot className="h-3 w-3" />
                  </div>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-blue-600 text-white"
                    : "rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0.5 prose-ul:my-1 prose-li:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="mr-1.5 mt-0.5 flex-shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <Bot className="h-3 w-3" />
                </div>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <div className="flex items-center gap-1.5 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t.loading}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          {remaining <= 0 ? (
            <p className="text-center text-xs text-slate-400 py-2">{t.limitReached}</p>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t.placeholder}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <button
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
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
