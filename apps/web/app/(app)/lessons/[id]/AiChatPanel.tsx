"use client";

// Помощник ИИ внутри урока.
//
// 08.08.2026 — вид и поведение приведены к общему помощнику ОДИН В ОДИН.
// Заход c1f4ef5 приводил их копированием разметки, и они снова разошлись:
// своё имя («Робокот» вместо «EduOS Assistant»), счётчик лимита стоял на
// месте строки «В сети», не было быстрых вопросов и подсветки кода, а кнопка
// помощника ПРОПАДАЛА при раскрытии панели (компонент возвращал либо кнопку,
// либо панель). Теперь разметка одна на оба чата — components/ai-chat-shell.tsx,
// там же объяснено, почему копии в этом проекте не выживают.
//
// Что осталось своим и НЕ тронуто: транспорт /api/ai/chat с lesson_id и
// stage_id (контекст урока плюс RAG-поиск по материалам урока), серверная
// история /api/ai/chat/history, свой лимит DAILY_LIMIT. Промты и запросы к
// Gemini не менялись — задача этого прямо не разрешает.
//
// Счётчик остатка: переехал со второй строки шапки на третью, ровно туда же,
// где он у общего помощника, и печатается той же строкой словаря
// (aiAssistant.usageLimitLabel). Своя строка ai.chat.remaining («Осталось:
// {n} из {total}») больше не используется здесь — она и создавала расхождение,
// на которое указал заказчик.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { AiChatShell, type AiChatShellMessage } from "@/components/ai-chat-shell";

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
  const ta = d.aiAssistant;

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(OPEN_KEY) === "1";
  });
  // Раз открытая панель остаётся смонтированной и просто прячется — так же,
  // как у общего помощника (AiFloatingButton): иначе повторное открытие
  // заново дёргало бы серверную историю.
  const [everOpened, setEverOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

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

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
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
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, remaining, lessonId, stageId, t],
  );

  const shellMessages: AiChatShellMessage[] = messages.map((m) => ({
    key: m.id,
    role: m.role === "assistant" ? "model" : "user",
    text: m.content,
  }));

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Кнопка видна ВСЕГДА, в том числе при раскрытой панели — как у общего
          помощника. Раньше компонент возвращал либо кнопку, либо панель, и
          кнопка исчезала; заказчик указал на это отдельным пунктом. */}
      <button
        onClick={toggle}
        title={d.nav.aiAssistant}
        aria-label={d.nav.aiAssistant}
        className="fixed bottom-20 right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-400 shadow-lg transition-transform hover:scale-105 hover:shadow-xl md:bottom-4"
      >
        <Sparkles className="h-6 w-6 text-white" strokeWidth={2} />
      </button>

      {everOpened && (
        <div
          className={
            open
              ? "fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] origin-bottom-right transition-all duration-200 md:bottom-20"
              : "pointer-events-none fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] origin-bottom-right scale-95 opacity-0 transition-all duration-200 md:bottom-20"
          }
          style={{ height: "min(600px, calc(100vh - 180px))" }}
        >
          <div className="h-full w-full rounded-[20px] shadow-2xl ring-1 ring-black/5">
            <AiChatShell
              title={ta.chatName}
              statusLabel={ta.onlineStatus}
              usage={{ remaining, limit: DAILY_LIMIT }}
              usageLabel={ta.usageLimitLabel
                .replace("{remaining}", String(remaining))
                .replace("{limit}", String(DAILY_LIMIT))}
              onClose={toggle}
              closeLabel={d.ai.fab.closeLabel}
              messages={shellMessages}
              loading={loading}
              welcomeTitle={ta.welcomeTitle}
              welcomeSubtitle={ta.welcomeSubtitle}
              quickQuestions={d.ai.fab.quickQuestions}
              onQuickQuestion={(q) => void send(q)}
              input={input}
              onInputChange={setInput}
              onSend={() => void send(input)}
              placeholder={ta.inputPlaceholder}
              inputRef={inputRef}
              blockedNote={remaining <= 0 ? t.limitReached : null}
            />
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
