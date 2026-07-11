"use client";

import { useRouter } from "next/navigation";
import {
  MapPin, User, ChevronRight, BookOpen,
  Calculator, Globe, Languages, BookText, Scroll, Map, Leaf, Atom,
  FlaskConical, Monitor, Code, Bot, Dumbbell, Music, Palette, Hammer,
  TreePine, Users,
} from "lucide-react";
import type { LessonWithSubject } from "@snr/core";
import { cn } from "@/lib/cn";

// Промт «скорость», Задача 7: `import * as Icons from "lucide-react"` тянул
// весь пакет (1000+ иконок, самый тяжёлый собственный код любого роута —
// 30.3 kB на /teacher/lessons) ради иконки по имени-строке из subjects.icon.
// Эти имена всегда приходят из SUBJECT_DEFAULTS (packages/core/queries/
// subjects.ts) — конечный список, явная карта вместо wildcard-импорта.
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; color?: string }>> = {
  Calculator, BookOpen, Globe, Languages, BookText, Scroll, Map, Leaf, Atom,
  FlaskConical, Monitor, Code, Bot, Dumbbell, Music, Palette, Hammer,
  TreePine, Users,
};

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
  });
}

function calcEndTime(startsAt: string, durationMin: number | null): string | null {
  if (!durationMin) return null;
  const end = new Date(new Date(startsAt).getTime() + durationMin * 60_000);
  return fmtTime(end.toISOString());
}

function LucideIcon({ name, size = 16, className, color }: {
  name: string; size?: number; className?: string; color?: string;
}) {
  const Comp = ICON_MAP[name];
  return Comp
    ? <Comp size={size} className={className} color={color} />
    : <BookOpen size={size} className={className} color={color} />;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

// ── status config ─────────────────────────────────────────────────────────────
type Status = "scheduled" | "in_progress" | "completed";

const STATUS_LABEL: Record<Status, string> = {
  scheduled:   "Запланирован",
  in_progress: "Идёт сейчас",
  completed:   "Завершён",
};
const STATUS_BADGE: Record<Status, string> = {
  scheduled:   "bg-blue-50 text-blue-600 border border-blue-200",
  in_progress: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  completed:   "bg-zinc-100 text-zinc-500 border border-zinc-200",
};
const STATUS_BORDER: Record<Status, string> = {
  scheduled:   "border-l-blue-400",
  in_progress: "border-l-emerald-500",
  completed:   "border-l-zinc-300",
};
const STATUS_BG: Record<Status, string> = {
  scheduled:   "bg-white",
  in_progress: "bg-emerald-50/40",
  completed:   "bg-zinc-50/60",
};

// ── component ─────────────────────────────────────────────────────────────────

export interface LessonCardLesson {
  id: string;
  title: string | null;
  topic: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  room: string | null;
  status: string;
  subject?: { name: string; icon: string; color: string } | null;
  group: {
    name: string;
    teacher: { full_name: string; avatar_url?: string | null } | null;
  };
}

export function LessonCard({
  lesson,
  variant = "default",
}: {
  lesson: LessonCardLesson;
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const status = (lesson.status as Status) in STATUS_LABEL
    ? (lesson.status as Status)
    : "scheduled";

  const startStr  = fmtTime(lesson.starts_at);
  const endStr    = lesson.ends_at
    ? fmtTime(lesson.ends_at)
    : calcEndTime(lesson.starts_at, lesson.duration_minutes);
  const timeRange = endStr ? `${startStr} — ${endStr}` : startStr;

  const displayTitle = lesson.title ?? lesson.topic ?? lesson.group.name;
  const subjectColor = lesson.subject?.color ?? "#64748B";
  const teacher = lesson.group.teacher;

  if (variant === "compact") {
    return (
      <button
        onClick={() => router.push(`/lessons/${lesson.id}`)}
        className={cn(
          "w-full text-left rounded-xl border-l-4 px-3 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
          STATUS_BORDER[status],
          STATUS_BG[status],
          "border border-zinc-100",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-500">{timeRange}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE[status])}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-zinc-800">{displayTitle}</p>
        {lesson.subject && (
          <div className="mt-0.5 flex items-center gap-1">
            <LucideIcon name={lesson.subject.icon} size={11} className="shrink-0" color={subjectColor} />
            <span className="text-[11px] text-zinc-500 truncate">{lesson.subject.name}</span>
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push(`/lessons/${lesson.id}`)}
      className={cn(
        "w-full text-left rounded-2xl border-l-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
        STATUS_BORDER[status],
        STATUS_BG[status],
        "border border-zinc-100",
      )}
    >
      {/* Top bar: time + status */}
      <div className="flex items-center justify-between gap-3 rounded-t-2xl px-4 py-2.5"
        style={{ background: `${subjectColor}18` }}>
        <span
          className="rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-sm"
          style={{ background: subjectColor }}
        >
          {timeRange}
        </span>
        <div className="flex items-center gap-1.5">
          {status === "in_progress" && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_BADGE[status])}>
            {STATUS_LABEL[status]}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-3 space-y-2.5">
        {/* Title */}
        <p className="text-base font-semibold text-zinc-900 leading-snug">{displayTitle}</p>

        {/* Subject row */}
        {lesson.subject && (
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
              style={{ background: `${subjectColor}22` }}
            >
              <LucideIcon name={lesson.subject.icon} size={13} color={subjectColor} />
            </div>
            <span className="text-sm text-zinc-600 font-medium">{lesson.subject.name}</span>
          </div>
        )}

        {/* Room */}
        {lesson.room && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span>Каб. {lesson.room}</span>
          </div>
        )}

        {/* Teacher */}
        {teacher && (
          <div className="flex items-center gap-2">
            {teacher.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={teacher.avatar_url}
                alt={teacher.full_name}
                className="h-6 w-6 rounded-full object-cover ring-1 ring-zinc-200"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600">
                {initials(teacher.full_name)}
              </div>
            )}
            <span className="text-sm text-zinc-600">{teacher.full_name}</span>
            <span className="text-xs text-zinc-400">· Учитель</span>
          </div>
        )}
      </div>
    </button>
  );
}

/** Адаптер: из `LessonWithSubject` (core type) → `LessonCardLesson`. */
export function lessonWithSubjectToCard(l: LessonWithSubject): LessonCardLesson {
  return {
    id: l.id,
    title: l.title,
    topic: l.topic,
    starts_at: l.starts_at,
    ends_at: l.ends_at,
    duration_minutes: l.duration_minutes,
    room: l.room,
    status: l.status,
    subject: l.subject,
    group: {
      name: l.group.name,
      teacher: l.group.teacher,
    },
  };
}
