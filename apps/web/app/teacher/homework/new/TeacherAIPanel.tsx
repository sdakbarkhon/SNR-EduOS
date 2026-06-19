"use client";

import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Bot, SendHorizonal, RefreshCw, Check, MessageSquare } from "lucide-react";
import { callGemini, generateHomeworkContent } from "@/app/actions/ai";
import { cn } from "@/lib/cn";

type Mode = "generate" | "chat";
type Difficulty = "easy" | "medium" | "hard";

interface GeneratedContent {
  title: string;
  description: string;
  questions?: Array<{ question: string; options: string[]; correctIndex: number }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  format: "file" | "test";
  subject: string;
  onApply: (data: GeneratedContent) => void;
}

const TEACHER_SYSTEM = `Ты — AI-помощник учителя школы. Помогай составлять учебные задания для учеников.
Отвечай кратко и по делу. Не используй markdown-разметку. Когда учитель описывает задание, предлагай перейти в режим генерации для автоматического создания.`;

type ChatMessage = { role: "user" | "model"; text: string };

export function TeacherAIPanel({ isOpen, onClose, format, subject, onApply }: Props) {
  const [mode, setMode] = useState<Mode>("generate");

  // Generate mode
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedContent | null>(null);

  // Chat mode
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setGenError(null);
      setGenerating(false);
    }
  }, [isOpen]);

  async function generate() {
    if (!topic.trim()) { setGenError("Введите тему"); return; }
    setGenerating(true);
    setGenError(null);
    setPreview(null);

    const result = await generateHomeworkContent({
      subject,
      topic: topic.trim(),
      taskType: format,
      difficulty,
    });

    setGenerating(false);
    if ("error" in result) {
      setGenError(result.error);
    } else {
      setPreview(result);
    }
  }

  async function sendChat() {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    setChatMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatInput("");
    setChatLoading(true);

    const history = chatMessages.map((m) => ({ role: m.role, text: m.text }));
    const result = await callGemini(TEACHER_SYSTEM, trimmed, history);
    const aiText = "error" in result ? "AI временно недоступен" : result.text;
    setChatMessages((prev) => [...prev, { role: "model", text: aiText }]);
    setChatLoading(false);
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-white/50 bg-white/95 shadow-2xl backdrop-blur-xl"
        style={{ animation: "snrSlideIn 0.22s ease-out" }}
      >
        <style>{`
          @keyframes snrSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold text-slate-800">AI-помощник для учителя</h2>
            <p className="text-[12px] text-slate-500">Я помогу составить задание</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-slate-200/60">
          {(["generate", "chat"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-2.5 text-[13px] font-semibold transition-colors",
                mode === m
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {m === "generate" ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Генерация
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Чат
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        {mode === "generate" ? (
          <div className="flex flex-1 flex-col overflow-y-auto p-5">
            {!preview ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Тема задания</label>
                  <textarea
                    rows={2}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder='Например: "Циклы for и while в Python"'
                    className="resize-none rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2 text-[14px] text-slate-800 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Тип задания</label>
                  <div
                    className={cn(
                      "rounded-[10px] border px-3 py-2 text-center text-[13px] font-medium",
                      "border-blue-200 bg-blue-50 text-blue-700",
                    )}
                  >
                    {format === "file" ? "Файл" : "Тест"} (из формы)
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-slate-700">Сложность</label>
                  <div className="flex gap-2">
                    {(
                      [
                        ["easy", "Лёгкое"],
                        ["medium", "Среднее"],
                        ["hard", "Сложное"],
                      ] as [Difficulty, string][]
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setDifficulty(val)}
                        className={cn(
                          "flex-1 rounded-[10px] border py-2 text-[12px] font-semibold transition-all",
                          difficulty === val
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {genError && (
                  <p className="text-[13px] font-medium text-red-500">{genError}</p>
                )}

                <button
                  onClick={generate}
                  disabled={generating}
                  className="w-full rounded-[12px] bg-gradient-to-r from-blue-500 to-indigo-600 py-3 text-[14px] font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Генерирую…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="h-4 w-4" /> Сгенерировать
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                {/* Preview */}
                <div className="rounded-[14px] border border-slate-200 bg-white p-4 space-y-3">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Название
                    </p>
                    <p className="text-[15px] font-bold text-slate-800">{preview.title}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Описание
                    </p>
                    <p className="text-[13px] leading-relaxed text-slate-600">
                      {preview.description}
                    </p>
                  </div>
                  {preview.questions && preview.questions.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Вопросы ({preview.questions.length})
                      </p>
                      <div className="space-y-3">
                        {preview.questions.map((q, qi) => (
                          <div key={qi} className="rounded-[10px] bg-slate-50 p-3">
                            <p className="mb-2 text-[13px] font-semibold text-slate-800">
                              {qi + 1}. {q.question}
                            </p>
                            <div className="space-y-1">
                              {q.options.map((opt, oi) => (
                                <div
                                  key={oi}
                                  className={cn(
                                    "flex items-center gap-2 rounded-[8px] px-2 py-1 text-[12px]",
                                    oi === q.correctIndex
                                      ? "bg-green-100 font-semibold text-green-800"
                                      : "text-slate-600",
                                  )}
                                >
                                  {oi === q.correctIndex ? (
                                    <Check className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <span className="h-3 w-3 shrink-0" />
                                  )}
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onApply(preview)}
                    className="flex-1 rounded-[12px] bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 text-[13px] font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-110"
                  >
                    Применить в форму
                  </button>
                  <button
                    onClick={() => { setPreview(null); setGenError(null); }}
                    title="Сгенерировать заново"
                    className="rounded-[12px] border border-slate-200 bg-white px-3 py-2.5 text-slate-500 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-[12px] border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Chat mode
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {chatMessages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                  <Bot className="h-10 w-10 text-slate-300" />
                  <p className="text-[13px] text-slate-500">
                    Расскажите что хотите создать, и я помогу сформулировать задание.
                  </p>
                </div>
              )}
              {chatMessages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-[14px] rounded-tr-sm bg-blue-600 px-3 py-2.5 text-[13px] text-white">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-[14px] rounded-tl-sm border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700">
                      {m.text}
                    </div>
                  </div>
                ),
              )}
              {chatLoading && (
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-[14px] rounded-tl-sm border border-slate-200 bg-white px-3 py-3">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="flex items-end gap-2 border-t border-slate-200/60 p-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Напишите что хотите создать…"
                rows={2}
                disabled={chatLoading}
                className="flex-1 resize-none rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-40"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              AI может ошибаться. Проверяй важную информацию.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
