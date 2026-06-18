import Link from "next/link";
import { ChevronLeft, MapPin, Check, Download, BookOpen, FileText, Target, Hammer, Pencil, CheckSquare, Trophy, type LucideIcon } from "lucide-react";
import type { StudentLessonView, LessonStagePublic, StageKey } from "@snr/core";
import { getSubjectStyle } from "@snr/core";

const STAGE_ICONS: Record<StageKey, LucideIcon> = {
  goal:      Target,
  theory:    BookOpen,
  practice:  Hammer,
  classwork: Pencil,
  review:    CheckSquare,
  summary:   Trophy,
};

const STAGE_LABELS: Record<StageKey, string> = {
  goal:       "Цель",
  theory:     "Теория",
  practice:   "Практика",
  classwork:  "Задание",
  review:     "Проверка",
  summary:    "Итог",
};

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long" });
}
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  lesson: StudentLessonView;
  materialUrls: Record<string, string>;
}

export function LessonView({ lesson, materialUrls }: Props) {
  const style = getSubjectStyle(lesson.group.subject);
  const rgb = hexToRgb(style.color);

  const stages = [...lesson.stages].sort((a, b) => a.order_index - b.order_index);
  const doneCount = stages.filter((s) => s.is_completed).length;

  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);

  const heroTitle = lesson.title ?? lesson.topic ?? `Урок от ${fmtDate(lesson.starts_at)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 text-[#1D1D1F]">
      {/* Back */}
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад к расписанию
      </Link>

      {/* Hero */}
      <div
        className="anim-fade-up relative flex min-h-[210px] flex-col gap-6 overflow-hidden rounded-[24px] p-8 text-white shadow-2xl"
        style={{
          background: `linear-gradient(135deg, rgb(${rgb}) 0%, color-mix(in sRGB, rgb(${rgb}) 60%, #1e1b4b) 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: "white" }} />

        <div className="relative z-10 flex flex-1 flex-col justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">
              {style.label} · {lesson.group.name}
            </p>
            {lesson.lesson_no && (
              <p className="mb-1 text-xs text-white/60">Урок №{lesson.lesson_no}</p>
            )}
            <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl">{heroTitle}</h2>
            {lesson.description && (
              <p className="mb-4 text-sm leading-relaxed text-white/80">{lesson.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium">
                {timeRange}
              </div>
              {lesson.teacher && (
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                    {initials(lesson.teacher.full_name)}
                  </div>
                  <span className="text-sm font-medium">{lesson.teacher.full_name}</span>
                </div>
              )}
              {lesson.room && (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-white/70" />
                  Каб. {lesson.room}
                </div>
              )}
            </div>
          </div>

          {stages.length > 0 && (
            <div className="mt-6 w-full max-w-sm md:mt-8">
              <div className="mb-2 flex justify-between text-xs font-medium text-white/80">
                <span>Прогресс урока</span>
                <span>{doneCount}/{stages.length} этапов</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700"
                  style={{ width: stages.length > 0 ? `${(doneCount / stages.length) * 100}%` : "0%" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stages (only if teacher enabled any) */}
      {stages.length > 0 && (
        <div className="anim-fade-up anim-delay-1">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
            Этапы урока
          </h3>
          <div className="relative flex items-center justify-between px-4">
            <div className="absolute left-[60px] right-[60px] top-[18px] z-0 h-[2px] bg-gray-200" />
            {stages.map((stage: LessonStagePublic) => {
              const label = STAGE_LABELS[stage.stage_key as StageKey] ?? stage.stage_key;
              return (
                <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-4 transition-transform duration-300 hover:scale-105 ${
                      stage.is_completed
                        ? "border-white bg-green-500 text-white shadow-sm"
                        : "border-gray-200 bg-white/70 text-gray-400 backdrop-blur-sm"
                    }`}
                  >
                    {stage.is_completed ? (
                      <Check className="h-5 w-5 text-white" strokeWidth={3} />
                    ) : (
                      (() => { const Icon = STAGE_ICONS[stage.stage_key as StageKey]; return Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-bold">{stage.order_index}</span>; })()
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      stage.is_completed ? "text-green-600" : "font-medium text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Materials */}
      <div className="anim-fade-up anim-delay-2">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
          Материалы урока
        </h3>
        {lesson.materials.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-5 py-4 text-sm text-gray-400 backdrop-blur-xl">
            <BookOpen className="h-4 w-4 shrink-0" />
            Материалы к этому уроку пока не добавлены
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lesson.materials.map((m) => {
              const url = materialUrls[m.id];
              return (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    {m.file_size_bytes && (
                      <p className="text-xs text-gray-400">{fmtBytes(m.file_size_bytes)}</p>
                    )}
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title="Скачать"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
