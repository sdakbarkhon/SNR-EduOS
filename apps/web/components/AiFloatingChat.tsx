"use client";

import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { callAiChat } from "@/app/actions/ai";
// 08.08.2026 — разметка панели переехала в общий AiChatShell, чтобы урочный
// помощник не расходился с этим по виду (заказчик требует «один в один»).
// Здесь остаётся только начинка: свой транспорт, своя история, свой лимит.
import { AiChatShell, type AiChatShellMessage, type AiChatUsage } from "./ai-chat-shell";

// Большой фикс, Блок 5, Фикс 2 — "ИИ не делает за ученика": промт
// переписан на сократический (наводящие вопросы, не готовые ответы), но
// правила визуализации (LaTeX/```chart) ниже НЕ трогал — отдельная,
// независимая возможность, вайплайн ChartBlock.tsx её ждёт в этом же
// формате.
// Формат ```chart блока — держать ТОЧНО синхронно с парсером
// (apps/web/lib/chart-spec.ts) и с рендером (apps/web/components/ChartBlock.tsx).
const STUDENT_SYSTEM = `Ты — помощник EduOS Assistant для школьника. Помогаешь понять темы и решать задачи, но НИКОГДА не давай готовых ответов.

Правила:
1. Если ученик спрашивает решение задачи → не давай его. Задавай уточняющие вопросы или наводи на первый шаг.
2. Если ученик пишет "напиши код за меня" → скажи "нет, но давай разберём что нужно". Объясняй концепцию, не пиши код целиком.
3. Если ученик прав на 90% решения → похвали, укажи что осталось.
4. Если ученик ошибся → не говори правильный ответ. Скажи "проверь строку X" или "что если Y=0?".
5. На "не знаю" → давай подсказку 1 из 3 (постепенно увеличивай).
6. Хвали за старания, не критикуй за ошибки.
7. Пиши коротко, дружелюбно, на "ты".

Если ученик всё ещё не понимает после 3 подсказок — можно дать более прямой намёк, но не готовое решение.

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

async function fetchAiUsage(): Promise<AiChatUsage & { used: number } | null> {
  try {
    const res = await fetch("/api/ai/usage", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AiChatUsage & { used: number };
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
  const [usage, setUsage] = useState<(AiChatUsage & { used: number }) | null>(null);

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
    // limit_reached — не сбой, а исчерпанный общий лимит: говорим об этом
    // словами, а не общей ошибкой «AI недоступен».
    const aiText =
      "error" in result
        ? (result.error === "limit_reached" ? t.usageLimitReached : t.errorFallback)
        : result.text;
    setMessages((prev) => [...prev, { role: "model", text: aiText }]);
    setLoading(false);
    void fetchAiUsage().then((u) => { if (u) setUsage(u); });
  }

  const shellMessages: AiChatShellMessage[] = messages.map((m, i) => ({
    key: String(i),
    role: m.role,
    text: m.text,
  }));

  return (
    <AiChatShell
      title={t.chatName}
      statusLabel={t.onlineStatus}
      usage={usage}
      usageLabel={
        usage
          ? t.usageLimitLabel
              .replace("{remaining}", String(usage.remaining))
              .replace("{limit}", String(usage.limit))
          : null
      }
      onClose={onClose}
      closeLabel={d.ai.fab.closeLabel}
      messages={shellMessages}
      loading={loading}
      welcomeTitle={t.welcomeTitle}
      welcomeSubtitle={t.welcomeSubtitle}
      quickQuestions={d.ai.fab.quickQuestions}
      onQuickQuestion={(q) => void send(q)}
      input={input}
      onInputChange={setInput}
      onSend={() => void send(input)}
      placeholder={t.inputPlaceholder}
    />
  );
}
