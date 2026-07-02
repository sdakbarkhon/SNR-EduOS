"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, MoreHorizontal, Calculator, Languages, Bug, BookOpen } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { callGemini } from "@/app/actions/ai";

const STUDENT_SYSTEM = `Ты — дружелюбный помощник для школьников.
Помогай с любыми вопросами кратко и понятно.
Используй простой язык. Не используй markdown-разметку.
Пиши обычным текстом без специальных символов форматирования.`;

const SUGGESTION_ICONS = [Calculator, Languages, Bug, BookOpen];

type Message = { role: "user" | "model"; text: string };

export function AiAssistantView() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.aiAssistant;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    const result = await callGemini(STUDENT_SYSTEM, trimmed, history);
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-slate-900">
          {t.title} <span className="text-2xl">🤖</span>
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">{t.subtitle}</p>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Chat card */}
        <div className="flex h-[640px] min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white bg-white/80 shadow-md backdrop-blur-xl">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-extrabold text-slate-900">{t.chatName}</p>
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t.onlineStatus}
              </p>
            </div>
            <MoreHorizontal className="h-5 w-5 text-slate-300" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-base font-bold text-slate-800">{t.welcomeTitle}</p>
                <p className="max-w-xs text-sm text-slate-500">{t.welcomeSubtitle}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[78%] rounded-[20px] rounded-tr-md bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-md shadow-indigo-500/20">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-end gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="max-w-[78%] whitespace-pre-wrap rounded-[20px] rounded-tl-md bg-[#F3F1FB] px-4 py-3 text-sm leading-relaxed text-slate-700">
                        {m.text}
                      </div>
                    </div>
                  ),
                )}

                {loading && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-[20px] rounded-tl-md bg-[#F3F1FB] px-4 py-4">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.inputPlaceholder}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-2xl bg-[#F4F2FC] px-4 py-3.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Right rail */}
        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
          <div className="rounded-[24px] border border-white bg-white/80 p-5 shadow-md backdrop-blur-xl">
            <h3 className="text-[17px] font-extrabold text-slate-900">{t.quickTopicsTitle}</h3>
            <p className="mb-3.5 mt-0.5 text-[13px] text-slate-500">{t.quickTopicsSubtitle}</p>
            <div className="flex flex-col gap-2.5">
              {t.suggestions.map((s, i) => {
                const Icon = SUGGESTION_ICONS[i] ?? Calculator;
                return (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="flex items-center gap-3 rounded-2xl bg-[#F7F5FF] px-3.5 py-3 text-left text-sm font-bold text-slate-800 transition-colors hover:bg-[#EFE9FF]"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-violet-600" />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] p-5 shadow-md" style={{ background: "linear-gradient(140deg,#EFEBFF,#EAE1FF)" }}>
            <h3 className="text-[16px] font-black text-slate-900">{t.tipTitle} 💡</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#7A6F98]">{t.tipBody}</p>
          </div>
        </aside>
      </div>

      <p className="text-center text-xs text-slate-400">{t.disclaimer}</p>
    </div>
  );
}
