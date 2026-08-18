"use client";

import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { usePathname } from "next/navigation";
import { askAssistant } from "@/lib/ai/ask-assistant";
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
// Своего промта здесь больше нет: их было три на три поверхности, и они
// расходились. Промт выбирает маршрут /api/ai/chat по наличию номера урока.

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
  // /lessons/<id> — значит ученик внутри урока. Хвосты вида /lessons/<id>/x
  // тоже считаются уроком: помощник открыт на том же занятии.
  const pathname = usePathname() ?? "";
  const lessonId = pathname.match(/^\/lessons\/([0-9a-f-]{36})/i)?.[1] ?? null;
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

    // КОРЕНЬ ПРЕЖНЕЙ БЕДЫ. Плавающая кнопка висит на всех экранах ученика,
    // включая экран урока, а урок в запрос не попадал вовсе — модель называла
    // тему по догадке. Теперь номер урока берётся из адреса страницы и уходит
    // вместе с вопросом: внутри урока помощник в режиме урока, снаружи —
    // обычный.
    const result = await askAssistant({ message: trimmed, lessonId });
    // limit_reached — не сбой, а исчерпанный общий лимит: говорим об этом
    // словами, а не общей ошибкой «AI недоступен».
    const aiText = result.ok
      ? result.text
      : result.reason === "limit_reached" ? t.usageLimitReached : t.errorFallback;
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
