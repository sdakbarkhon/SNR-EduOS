"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Bot, SendHorizonal } from "lucide-react";
import { callGemini } from "@/app/actions/ai";

const STUDENT_SYSTEM = `Ты — школьный помощник по учёбе для ученика 7 класса.
Помогай ТОЛЬКО с вопросами связанными с учёбой: предметы, домашние задания, объяснение тем, помощь в решении задач, советы по подготовке к контрольным.

СТРОГО ОТКАЗЫВАЙ если вопрос не про учёбу: личные темы, развлечения, взрослые темы, политика, новости и т.д. В таком случае отвечай: "Я могу помочь только с учёбой. Спроси меня про предметы или домашние задания."

Отвечай кратко и понятно для 7-классника. Используй простой язык. Не используй markdown-разметку. Пиши обычным текстом.`;

const SUGGESTIONS = [
  "Объясни циклы в Python",
  "Помоги с домашкой по математике",
  "Как подготовиться к контрольной",
  "Что такое алгоритм?",
];

type Message = { role: "user" | "model"; text: string };

export function AiAssistantView() {
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
    const aiText =
      "error" in result ? "AI временно недоступен, попробуй позже" : result.text;
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
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            AI-помощник по учёбе
          </h1>
          <p className="text-xs text-slate-500">Задай вопрос по любому предмету</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-[24px] border border-white/50 bg-white/40 p-5 backdrop-blur-xl">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="mb-1 text-lg font-bold text-slate-800">
                Привет! Я твой помощник по учёбе.
              </h2>
              <p className="text-sm text-slate-500">
                Спроси меня про любой предмет или попроси объяснить тему.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[75%] rounded-[18px] rounded-tr-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-md shadow-blue-600/20">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-[18px] rounded-tl-md border border-white/60 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm backdrop-blur-xl">
                    {m.text}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-[18px] rounded-tl-md border border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="mt-4 flex items-end gap-2 rounded-[18px] border border-white/50 bg-white/70 p-2 shadow-sm backdrop-blur-xl">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напиши свой вопрос… (Enter — отправить, Shift+Enter — перенос)"
          rows={1}
          disabled={loading}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30 transition-all hover:bg-blue-700 disabled:opacity-40"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
