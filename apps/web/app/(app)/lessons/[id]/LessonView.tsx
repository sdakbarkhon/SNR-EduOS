import Link from "next/link";
import {
  ChevronLeft, MapPin, User as User2, Check, Clock,
  FileText, MonitorPlay, FileCode2, CircuitBoard,
} from "lucide-react";

// ── Моки (захардкожены, без БД) ──
const stages = [
  { id: 1, label: "Цель", status: "completed" },
  { id: 2, label: "Теория", status: "completed" },
  { id: 3, label: "Практика", status: "completed" },
  { id: 4, label: "Задание", status: "completed" },
  { id: 5, label: "Проверка", status: "active" },
  { id: 6, label: "Итог", status: "pending" },
] as const;

const materials = [
  { id: 1, title: "Презентация", icon: MonitorPlay, color: "text-orange-600", bg: "bg-orange-100" },
  { id: 2, title: "Инструкция", icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
  { id: 3, title: "Схемы", icon: CircuitBoard, color: "text-purple-600", bg: "bg-purple-100" },
  { id: 4, title: "Примеры кода", icon: FileCode2, color: "text-emerald-600", bg: "bg-emerald-100" },
];

export function LessonView() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 text-[#1D1D1F]">
      {/* Назад к расписанию */}
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад к расписанию
      </Link>

      {/* Hero */}
      <div className="anim-fade-up relative flex min-h-[210px] flex-col gap-8 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1E40AF] via-[#4338CA] to-[#7C3AED] p-8 text-white shadow-2xl md:flex-row">
        <div className="relative z-10 flex flex-1 flex-col justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">
              Робототехника и электроника
            </p>
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              Урок 12. Управление <br className="hidden lg:block" /> светодиодом и кнопкой
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200">
                  <User2 className="h-3 w-3 text-indigo-700" />
                </div>
                <span className="text-sm font-medium">Иван Петрович</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-white/70" />
                Кабинет 305
              </div>
            </div>
          </div>
          <div className="mt-6 w-full max-w-sm md:mt-10">
            <div className="mb-2 flex justify-between text-xs font-medium text-white/80">
              <span>Прогресс урока</span>
              <span>5/7 этапов</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className="anim-grow h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]" style={{ width: "70%" }} />
            </div>
          </div>
        </div>

        <div className="anim-bob mx-auto flex w-48 flex-shrink-0 items-center justify-center opacity-90 md:mx-0 lg:w-[180px]">
          <div className="relative">
            <div className="flex h-20 w-32 -rotate-6 items-center justify-center rounded-xl border border-white/20 bg-indigo-900/50 backdrop-blur-sm">
              <div className="h-2 w-24 rounded-full bg-green-400" />
            </div>
            <div className="absolute right-0 top-0 h-12 w-12 -translate-y-1/2 translate-x-1/2 overflow-hidden rounded-full border-4 border-white/20 bg-orange-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1555664424-778a1e5e1b48?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                alt="Робототехника"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="anim-fade-up anim-delay-1">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">Этапы урока</h3>
        <div className="relative flex items-center justify-between px-4">
          <div className="absolute left-[60px] right-[60px] top-[18px] z-0 h-[2px] bg-gray-200" />
          {stages.map((stage) => (
            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border-4 transition-transform duration-300 hover:scale-105 ${
                stage.status === "completed"
                  ? "border-white bg-green-500 text-white shadow-sm"
                  : stage.status === "active"
                  ? "border-white bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] ring-4 ring-blue-100"
                  : "border-gray-200 bg-white/70 text-gray-400 backdrop-blur-sm"
              }`}>
                {stage.status === "completed" ? (
                  <Check className="h-5 w-5 text-white" strokeWidth={3} />
                ) : stage.status === "active" ? (
                  <div className="h-2 w-2 rounded-full bg-white" />
                ) : (
                  <span className="text-xs font-bold">{stage.id}</span>
                )}
              </div>
              <span className={`text-xs font-bold ${
                stage.status === "completed" ? "text-green-600" : stage.status === "active" ? "text-blue-700" : "font-medium text-gray-400"
              }`}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div className="anim-fade-up anim-delay-2">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">Материалы урока</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {materials.map((item) => (
            <div key={item.id} className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} ${item.color} transition-transform duration-300 group-hover:scale-110`}>
                <item.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold">{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Task */}
      <div className="anim-fade-up anim-delay-3 flex flex-1 flex-col">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">Задание урока</h3>
        <div className="flex flex-col rounded-2xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Соберите схему на макетной плате, используя один светодиод, резистор 220 Ом и тактовую кнопку. Ваша задача — написать скетч для Arduino так, чтобы светодиод загорался только при нажатой кнопке. Убедитесь в правильности подключения полярности и надежности соединений перед подключением питания.
          </p>
          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-400">Осталось: 45 минут</span>
            </div>
            <button className="rounded-xl bg-[#2563EB] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] hover:bg-blue-700 hover:shadow-blue-600/50 active:scale-[0.98]">
              Начать задание
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
