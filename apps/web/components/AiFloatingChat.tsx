"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { callAiChat } from "@/app/actions/ai";

const STUDENT_SYSTEM = `Ты — дружелюбный помощник для школьников.
Помогай с любыми вопросами кратко и понятно.
Используй простой язык. Не используй markdown-разметку.
Пиши обычным текстом без специальных символов форматирования.`;

// sessionStorage (not localStorage): a fresh browser session starts a clean
// chat, but navigating between pages or closing/reopening the widget within
// the same session keeps history (§6.3).
const HISTORY_KEY = "ai_fab_history";

type Message = { role: "user" | "model"; text: string };

function loadHistory(): Message[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

export function AiFloatingChat({ onClose }: { onClose: () => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.aiAssistant;

  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    } catch {
      /* blocked */
    }
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const result = await callAiChat(STUDENT_SYSTEM, trimmed, history);
    const aiText = "error" in result ? t.errorFallback : result.text;
    setMessages((prev) => [...prev, { role: "model", text: aiText }]);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] bg-white">
      {/* Шапка */}
      <div className="flex shrink-0 items-center gap-3 rounded-t-[20px] bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-3.5 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{t.chatName}</p>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t.onlineStatus}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={d.ai.fab.closeLabel}
          title={d.ai.fab.closeLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Сообщения */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div>
              <p className="text-sm font-bold text-slate-800">{t.welcomeTitle}</p>
              <p className="mt-1 max-w-[280px] text-xs text-slate-500">{t.welcomeSubtitle}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {d.ai.fab.quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-2xl bg-[#F7F5FF] px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-800 transition-colors hover:bg-[#EFE9FF]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[82%] rounded-[16px] rounded-tr-md bg-gradient-to-br from-violet-500 to-indigo-600 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="max-w-[82%] whitespace-pre-wrap rounded-[16px] rounded-tl-md bg-[#F3F1FB] px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700">
                    {m.text}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Bot className="h-3.5 w-3.5" />
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
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.inputPlaceholder}
          rows={1}
          disabled={loading}
          className="flex-1 resize-none rounded-xl bg-[#F4F2FC] px-3.5 py-2.5 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
          style={{ maxHeight: "96px" }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
