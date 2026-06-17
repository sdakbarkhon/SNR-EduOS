import { Sparkles, Paperclip, SendHorizonal } from "lucide-react";

// ── Моки чата (захардкожены, без БД / без вызовов AI) ──
const messages: { role: "user" | "assistant"; text: string }[] = [
  { role: "assistant", text: "Привет! Я твой AI-помощник. Спроси что угодно по учёбе — объясню тему, помогу с задачей или подскажу, с чего начать." },
  { role: "user", text: "Объясни как работают датчики на Arduino" },
  { role: "assistant", text: "Датчик измеряет физическую величину (свет, температуру, расстояние) и преобразует её в электрический сигнал. Arduino читает этот сигнал на аналоговом (A0–A5) или цифровом пине и переводит в число через analogRead() или digitalRead(). Дальше ты используешь это значение в коде — например, включаешь светодиод, когда темно." },
];

export function AiAssistantView() {
  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">AI-помощник</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-[24px] border border-white/50 bg-white/40 p-5 backdrop-blur-xl">
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
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] rounded-[18px] rounded-tl-md border border-white/60 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm backdrop-blur-xl">
                {m.text}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Input bar (визуальная заглушка — ничего не отправляет) */}
      <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-white/50 bg-white/70 p-2 shadow-sm backdrop-blur-xl">
        <button className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          type="text"
          placeholder="Напиши свой вопрос…"
          className="flex-1 bg-transparent px-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
        />
        <button className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30 transition-all hover:bg-blue-700">
          <SendHorizonal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
