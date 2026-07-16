"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, MoreHorizontal, Calculator, Languages, Bug, BookOpen } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { callAiChat } from "@/app/actions/ai";
import { EDUOS_ASSISTANT_STUDENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const SUGGESTION_ICONS = [Calculator, Languages, Bug, BookOpen];

// Промт "Gemini migration", ЧАСТЬ 5.3 — раньше вся история чата (растёт без
// ограничений в клиентском state) целиком уходила на сервер при КАЖДОМ новом
// сообщении. Отправляем только последние 15 — простая обрезка без
// суммаризации (упрощённый вариант, явно разрешённый ТЗ вместо
// summary-каждые-20-сообщений — экономия input-токенов важнее полного
// сохранения контекста для этого чата). В UI видна вся история, обрезается
// только то, что уходит в запрос.
const MAX_HISTORY_MESSAGES = 15;

// Пачка 3, Задача 2 — глобальный дневной лимит Gemini под чатом (миграция
// 136). Обновляется раз в 30с (polling — в проекте нет прецедента realtime
// для этого чата, см. инвентаризацию) + оптимистично при отправке
// сообщения, скорректировано по факту после ответа сервера.
const USAGE_POLL_INTERVAL_MS = 30_000;

type Message = { role: "user" | "model"; text: string };
type AiUsage = { used: number; limit: number; remaining: number };

async function fetchAiUsage(): Promise<AiUsage | null> {
  try {
    const res = await fetch("/api/ai/usage", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AiUsage;
  } catch {
    return null;
  }
}

export function AiAssistantView() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.aiAssistant;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const u = await fetchAiUsage();
      if (!cancelled && u) setUsage(u);
    }
    void refresh();
    const interval = setInterval(refresh, USAGE_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    // Оптимистично уменьшаем счётчик сразу (не ждём ответа AI) — корректируем
    // на реальное значение после того, как запрос отработает (успешно или нет).
    setUsage((prev) => (prev ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) } : prev));

    const history = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, text: m.text }));
    const result = await callAiChat(EDUOS_ASSISTANT_STUDENT_SYSTEM_PROMPT, trimmed, history);
    const aiText = "error" in result ? t.errorFallback : result.text;
    setMessages((prev) => [...prev, { role: "model", text: aiText }]);
    setLoading(false);
    void fetchAiUsage().then((u) => { if (u) setUsage(u); });
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
          {t.title} <Bot className="h-7 w-7 text-violet-500" />
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
              {/* Пачка 4, Задача 0A — перенесено из-под поля ввода. Фон —
                  тот же фиолетовый градиент, что у аватара чата (в самой
                  шапке нет сплошной заливки, поэтому "белый текст на
                  фиолетовом" реализован как маленькая пилюля). */}
              {usage && (
                <p
                  className={`mt-1 inline-block w-fit rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold opacity-85 ${
                    usage.remaining < 50
                      ? "text-red-300"
                      : usage.remaining <= 100
                        ? "text-yellow-300"
                        : "text-white"
                  }`}
                >
                  {t.usageLimitLabel.replace("{remaining}", String(usage.remaining)).replace("{limit}", String(usage.limit))}
                </p>
              )}
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
        </aside>
      </div>

      <p className="text-center text-xs text-slate-400">{t.disclaimer}</p>
    </div>
  );
}
