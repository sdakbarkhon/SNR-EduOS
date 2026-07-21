"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Bot, Send, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { callAiChat } from "@/app/actions/ai";
import { SyntaxHighlighter, oneDark } from "./lesson-stages/highlighter";

// function-plot (+ d3) — тяжёлая связка, нужна редко (только когда AI
// реально прислал ```chart), не должна попадать в основной бандл
// AppShell → AiFloatingButton → AiFloatingChat, который грузится на каждой
// странице ученика. ssr:false — function-plot трогает DOM напрямую.
const ChartBlock = dynamic(() => import("./ChartBlock").then((m) => m.ChartBlock), {
  ssr: false,
  loading: () => <div className="my-1 h-[200px] animate-pulse rounded-xl bg-slate-100" />,
});

// Формат ```chart блока — держать ТОЧНО синхронно с парсером
// (apps/web/lib/chart-spec.ts) и с рендером (apps/web/components/ChartBlock.tsx).
const STUDENT_SYSTEM = `Ты — дружелюбный помощник для школьников.
Помогай с любыми вопросами кратко и понятно. Используй простой язык.

Визуализация (используй только когда это реально помогает, не в каждом ответе):
- Если вопрос касается математики или физики и уместна формула — записывай её в LaTeX: инлайн-формулы через $...$ прямо в строке текста; отдельно стоящие (крупные) формулы — знаки $$ каждый на СВОЕЙ строке, а сама формула между ними на отдельной строке, например:
$$
a^2 + b^2 = c^2
$$
Не пиши $$формула$$ в одну строку — так формула не отрендерится крупным блоком.
- Если полезно показать график функции y=f(x) — вставь блок в точности такого формата:
\`\`\`chart
type: function
expr: x^2
domain: -5, 5
\`\`\`
где expr — выражение от x (например x^2, sin(x), 2*x+1), domain — нижняя и верхняя граница x через запятую.
- На обычных вопросах, не требующих формул или графиков, отвечай обычным текстом — без LaTeX и без chart-блоков.
- Не злоупотребляй визуализациями.`;

// code-блоки (```python и т.п.) рендерятся тем же подсвечивателем, что и
// везде в проекте (см. lesson-stages/markdownCode.tsx — та же логика,
// продублирована здесь напрямую вместо reuse через объект-компонент, чтобы
// не бороться с типами react-markdown при делегировании) — ```chart
// перехватывается раньше и уходит в ChartBlock, остальные языки/инлайн-код
// не меняются.
const messageComponents: Components = {
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

// Пачка 4, Задача B — этот плавающий виджет является ОТДЕЛЬНОЙ от
// AiAssistantView.tsx копией шапки чата (скопирована до того, как там
// появился дневной лимит Gemini, миграция 136) — лимит сюда не попадал
// вообще, это не баг рендера, а отсутствующий код. Та же логика, что и
// в AiAssistantView.tsx: опрос раз в 30с + оптимистичный декремент.
const USAGE_POLL_INTERVAL_MS = 30_000;
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

export function AiFloatingChat({ onClose }: { onClose: () => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.aiAssistant;

  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

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
    setUsage((prev) => (prev ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) } : prev));

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const result = await callAiChat(STUDENT_SYSTEM, trimmed, history);
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
          {usage && (
            <p
              className={`mt-0.5 text-[11px] font-semibold opacity-85 ${
                usage.remaining < 50
                  ? "text-red-300"
                  : usage.remaining <= 100
                    ? "text-yellow-300"
                    : "text-white/85"
              }`}
            >
              {t.usageLimitLabel.replace("{remaining}", String(usage.remaining)).replace("{limit}", String(usage.limit))}
            </p>
          )}
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
                  <div className="max-w-[82%] rounded-[16px] rounded-tl-md bg-[#F3F1FB] px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700">
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={messageComponents}>
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
