"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Plus,
  MoreHorizontal, Pencil, Trash2, X, AlertTriangle, CalendarDays, CalendarRange,
} from "lucide-react";
import {
  createLesson, updateLesson, deleteLesson, getLessonGrades,
  getTeacherLessonsByMonth, getDictionary, defaultLocale,
  getCurriculumPlanForGroupSubject, getCurriculumTopicsWithUsage,
  tashkentDayKey, tashkentParts, tashkentMonthBoundsUtc,
} from "@snr/core";
import type { SubjectWithGroup, Locale, CurriculumTopicWithUsage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { IosTimePicker } from "@/components/IosTimePicker";
import { PageContainer } from "@/components/PageContainer";
import { LessonSubjectIcon } from "@/components/LessonSubjectIcon";
import { useToast } from "@/components/Toast";
import { ErrorState } from "@/components/ErrorState";
import { isDemoEditBlockedError } from "@/lib/useIsDemoSession";
import { useSchoolNow, useSchoolNowSnapshot } from "@/components/SchoolTimeProvider";
import { BulkLessonsModal } from "./BulkLessonsModal";
import { ModalPortal } from "@/components/ModalPortal";

// ── Types ─────────────────────────────────────────────────────────────────────
type GroupItem = { id: string; name: string; subject: string };
type LessonItem = {
  id: string; group_id: string; lesson_no: number | null;
  topic: string | null; title: string | null;
  starts_at: string; ends_at: string | null; room: string | null;
  status: string; started_at: string | null; ended_at: string | null;
  group: { id: string; name: string; subject: string };
  // 26.08.2026: иконка на карточке — единственный признак предмета в этом
  // списке, и она бралась из заглушки group.subject.
  subject?: { name: string; icon: string | null; color: string | null } | null;
  // 30.08.2026 (пункт 78): id предмета выборка отдавала и раньше, тип его
  // не объявлял — и форма правки не могла подставить текущий предмет.
  subject_id?: string | null;
};
type FormState = {
  groupId: string; subjectId: string; date: string; startTime: string;
  room: string; title: string; desc: string;
  // Промт 4, Часть 5 — тема из учебного плана; null/"" = "своя тема" (title — свободный ввод как раньше).
  curriculumTopicId: string;
};
type EffectiveStatus = "scheduled" | "in_progress" | "completed";
type DayStatus = "in_progress" | "completed" | "scheduled" | null;

// ── Effective status ──────────────────────────────────────────────────────────
// Решение (после отключения авто-режима, миграции 143): урок без ручного
// старта остаётся "Запланирован" независимо от того, сколько времени прошло
// с starts_at — статуса "Пропущен"/"missed" в системе больше нет. Прошедшие
// дни закрывает полуночный крон close-past-lessons (00:00 Ташкент), в
// течение дня показываем нейтральный "Запланирован" (не трогать этот крон —
// он уже работает правильно).
function getEffectiveStatus(lesson: LessonItem): EffectiveStatus {
  if (lesson.status === "in_progress") return "in_progress";
  if (lesson.status === "completed")   return "completed";
  return "scheduled";
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

const EFF_BADGE: Record<EffectiveStatus, { label: string; cls: string; dot?: boolean }> = {
  scheduled:   { label: "Запланирован", cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  in_progress: { label: "Идёт сейчас", cls: "bg-yellow-100 text-yellow-800 border border-yellow-200", dot: true },
  completed:   { label: "Завершён",    cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
};
// Card background (soft fill)
const EFF_CARD_BG: Record<EffectiveStatus, string> = {
  scheduled:   "bg-blue-50",
  in_progress: "bg-yellow-50",
  completed:   "bg-emerald-50",
};
// Left border colour
const EFF_BORDER: Record<EffectiveStatus, string> = {
  scheduled:   "border-l-blue-400",
  in_progress: "border-l-yellow-400",
  completed:   "border-l-emerald-400",
};
// Dot colour (used both in legend and in calendar cells)
const EFF_DOT: Record<EffectiveStatus, string> = {
  scheduled:   "bg-blue-400",
  in_progress: "bg-yellow-400",
  completed:   "bg-emerald-400",
};

// Calendar cell background (aggregate)
const DAY_BG: Record<NonNullable<DayStatus>, string> = {
  in_progress: "bg-yellow-50/70 border border-yellow-200",
  completed:   "bg-emerald-50/70 border border-emerald-200",
  scheduled:   "bg-blue-50/70 border border-blue-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// 26.08.2026 — КЛЮЧ ДНЯ И СЕТКА БОЛЬШЕ НЕ ЗАВИСЯТ ОТ ПОЯСА СРЕДЫ.
//
// Было: localDateKey читал дату через getFullYear/getMonth/getDate, то есть в
// поясе сервера — на Vercel это UTC. Каждые сутки с 00:00 до 05:00 по Ташкенту
// ключ указывал на вчерашний день: подсветка «сегодня» стояла не на той
// клетке, а уроки раскладывались по соседним дням.
//
// Ячейки сетки — позиции, а не моменты: строим их полуночью UTC, тогда
// getUTC* читает ровно то, что положили, в любом поясе.
function lessonDateKey(iso: string): string { return tashkentDayKey(iso); }

function getCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  let dow = firstDay.getUTCDay();
  dow = dow === 0 ? 6 : dow - 1; // Пн=0 … Вс=6
  const days: Date[] = [];
  const start = new Date(Date.UTC(year, month - 1, 1 - dow));
  for (let i = 0; i < 42; i++)
    days.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i)));
  return days;
}

function aggregateDayStatus(dayLessons: LessonItem[]): DayStatus {
  if (dayLessons.length === 0) return null;
  if (dayLessons.some(l => l.status === "in_progress")) return "in_progress";
  if (dayLessons.every(l => l.status === "completed")) return "completed";
  return "scheduled";
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" });
}
function fmtDayHeader(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tashkent" });
}
function toLocalDateStr(iso: string): string { return tashkentDayKey(iso); }
function toLocalTimeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" });
}
// 26.08.2026: дата и время из формы читаются КАК ТАШКЕНТСКИЕ.
// Было new Date(`${date}T${time}:00`) — разбор в поясе браузера. Поле времени
// при этом заполнялось через toLocalTimeStr с явным timeZone: Asia/Tashkent,
// то есть два поля одной формы жили в разных поясах. У учителя из Ташкента
// совпадало случайно; у любого другого урок уезжал на разницу поясов.
function buildIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}
function emptyForm(groupId = ""): FormState {
  return { groupId, subjectId: "", date: "", startTime: "", room: "", title: "", desc: "", curriculumTopicId: "" };
}
function lessonToForm(l: LessonItem): FormState {
  return {
    // 30.08.2026 — БЫЛО subjectId: "". Селектор предмета в правке рисовался
    // (он зависит только от группы), показывал «— выберите предмет —» и
    // выглядел так, будто предмет у урока не задан. Теперь подставляем
    // текущий: человек видит, что стоит, и меняет осознанно.
    groupId: l.group_id, subjectId: l.subject_id ?? "",
    date: toLocalDateStr(l.starts_at),
    startTime: toLocalTimeStr(l.starts_at),
    room: l.room ?? "", title: l.title ?? "", desc: "",
    curriculumTopicId: "", // Часть 5 — редактирование НЕ предлагает селектор темы
  };
}

// ── CardMenu ──────────────────────────────────────────────────────────────────
function CardMenu({
  onEdit, onDelete,
}: {
  onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Pencil className="h-3.5 w-3.5" /> Редактировать
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3.5 w-3.5" /> Удалить
          </button>
        </div>
      )}
    </div>
  );
}

// ── LessonCard ────────────────────────────────────────────────────────────────
function LessonCard({
  lesson, onEdit, onDelete, readOnly = false,
}: {
  lesson: LessonItem;
  onEdit: (l: LessonItem) => void; onDelete: (l: LessonItem) => void;
  readOnly?: boolean;
}) {
  const displayTitle = lesson.title ?? lesson.topic ?? fmtDate(lesson.starts_at);
  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);
  const eff = getEffectiveStatus(lesson);
  const badge = EFF_BADGE[eff];

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-white/60 p-3 pl-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 ${EFF_CARD_BG[eff]} ${EFF_BORDER[eff]}`}>
      <Link href={`/teacher/lessons/${lesson.id}`} className="flex flex-1 items-center gap-3 min-w-0">
        <LessonSubjectIcon icon={lesson.subject?.icon} color={lesson.subject?.color} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate text-xs font-bold text-[#1D1D1F]">{displayTitle}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
              {badge.dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />}
              {badge.label}
            </span>
          </div>
          <p className="text-[10px] text-gray-500">{lesson.group.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{timeRange}</span>
            {lesson.room && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Каб. {lesson.room}</span>}
          </div>
        </div>
      </Link>
      {!readOnly && (
        <CardMenu onEdit={() => onEdit(lesson)} onDelete={() => onDelete(lesson)} />
      )}
    </div>
  );
}

// ── DatePickerField ───────────────────────────────────────────────────────────
function DatePickerField({
  value, onChange, inputCls, minToday = false,
}: {
  value: string; onChange: (v: string) => void; inputCls: string; minToday?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Z.3, заход 3 — «сегодня» школы для нижней границы календаря. Свой вызов
  // хука: это отдельный компонент, до значения из TeacherLessonsView ему не
  // дотянуться, а провайдер один на всё дерево.
  const schoolNowMs = useSchoolNowSnapshot();

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectedDate = value ? new Date(`${value}T12:00:00`) : undefined;
  const display = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent",
      })
    : "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${!value ? "text-gray-400" : ""}`}
      >
        <span>{display || "Выберите дату"}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-[200] mt-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          style={{
            // Override rdp accent colour to match design blue
            ["--rdp-accent-color" as string]: "#2563eb",
            ["--rdp-accent-background-color" as string]: "#eff6ff",
            ["--rdp-day-height" as string]: "36px",
            ["--rdp-day-width" as string]: "36px",
            ["--rdp-day_button-height" as string]: "34px",
            ["--rdp-day_button-width" as string]: "34px",
          }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (!d) return;
              // DayPicker отдаёт локальную полночь выбранной клетки — это
              // календарная дата, а не момент. Читаем её теми же локальными
              // полями, какими она и создана: подмешивать сюда пояс нельзя,
              // иначе выбор съедет на день.
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${day}`);
              setOpen(false);
            }}
            disabled={minToday ? { before: new Date(new Date(schoolNowMs()).setHours(0, 0, 0, 0)) } : undefined}
          />
        </div>
      )}
    </div>
  );
}

// ── LessonFormModal ───────────────────────────────────────────────────────────
function LessonFormModal({
  mode, groups, teacherSubjects, initial, editLessonId, onClose, onSave,
}: {
  mode: "create" | "edit"; groups: GroupItem[];
  teacherSubjects: SubjectWithGroup[];
  initial: FormState;
  /** Правим существующий урок — его id. Нужен ровно для одного: узнать,
   *  есть ли у урока оценки, и предупредить перед сменой предмета. */
  editLessonId?: string;
  onClose: () => void; onSave: (f: FormState) => Promise<void>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).lesson;
  const dc = getDictionary(locale as Locale).curriculum;
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // СКОЛЬКО ОЦЕНОК УЖЕ СТОИТ У ЭТОГО УРОКА. 30.08.2026, пункт 78.
  //
  // Оценки за урок висят на lesson_id, а не на предмете, и при смене
  // предмета уезжают вместе с уроком — ни одна не теряется, но начинают
  // числиться по другому предмету. Отличить «исправляю опечатку» от
  // «переношу историю» может только человек, поэтому решение оставляем ему,
  // а числом предупреждаем.
  //
  // Статус урока для этого не годится: в демо-школе 16 из 84 уроков со
  // статусом scheduled уже несут по десять оценок. Спрашиваем сами оценки.
  const [оценокУУрока, setОценокУУрока] = useState<number | null>(null);
  useEffect(() => {
    if (mode !== "edit" || !editLessonId) return;
    let отменено = false;
    getLessonGrades(createClient(), editLessonId)
      .then((rows) => { if (!отменено) setОценокУУрока(rows.length); })
      .catch(() => { if (!отменено) setОценокУУрока(null); });
    return () => { отменено = true; };
  }, [mode, editLessonId]);

  const предметМеняют = mode === "edit" && !!form.subjectId && form.subjectId !== initial.subjectId;
  const предупредить = предметМеняют && (оценокУУрока ?? 0) > 0;

  function set(key: keyof FormState, val: string) { setForm(p => ({ ...p, [key]: val })); }

  // Subjects for the currently selected group (from teacher's subjects)
  const groupSubjects = teacherSubjects.filter(s => s.group_id === form.groupId);
  // Groups that have at least one subject assigned to this teacher
  const groupsWithSubjects = groups.filter(g => teacherSubjects.some(s => s.group_id === g.id));

  // ЧАСТЬ В: предметник после серверного фильтра видит ровно один предмет на
  // группу — выбираем его сразу, чтобы не заставлять кликать единственный пункт.
  useEffect(() => {
    if (groupSubjects.length === 1 && form.subjectId !== groupSubjects[0]!.id) {
      set("subjectId", groupSubjects[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.groupId]);

  // Промт 4, Часть 5 — тема из плана. ТОЛЬКО при создании урока (Часть 5:
  // "форму редактирования — селектор не добавлять"), только когда у пары
  // (группа, предмет) есть план.
  const [planTopics, setPlanTopics] = useState<CurriculumTopicWithUsage[] | null>(null);
  const [useCustomTopic, setUseCustomTopic] = useState(true);
  useEffect(() => {
    if (mode !== "create" || !form.groupId || !form.subjectId) { setPlanTopics(null); return; }
    let cancelled = false;
    const db = createClient();
    getCurriculumPlanForGroupSubject(db, form.groupId, form.subjectId)
      .then((plan) => {
        if (cancelled) return;
        if (!plan) { setPlanTopics(null); setUseCustomTopic(true); return; }
        return getCurriculumTopicsWithUsage(db, plan.id).then((topics) => {
          if (cancelled) return;
          setPlanTopics(topics);
          setUseCustomTopic(topics.length === 0);
        });
      })
      .catch(() => { if (!cancelled) setPlanTopics(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, form.groupId, form.subjectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groupId)   { setError("Выберите группу"); return; }
    // Предмет обязателен ВЕЗДЕ, и при создании, и при правке. С миграции 226
    // он not-null; уроки без предмета были бы невидимы предметникам
    // (filterBySubject), а INSERT без него отклоняет правило доступа.
    //
    // 30.08.2026 — в правке требуем тоже. Раньше не требовали, потому что
    // updateLesson предмет не принимал; теперь принимает, и пустое поле
    // здесь означало бы «сбросить обязательное» — этого не бывает.
    if (!form.subjectId) { setError("Выберите предмет"); return; }
    if (!form.date)      { setError("Укажите дату"); return; }
    if (!form.startTime) { setError("Укажите время начала"); return; }
    setSaving(true); setError("");
    try { await onSave(form); }
    catch (err: unknown) {
      setError(
        isDemoEditBlockedError(err)
          ? getDictionary(defaultLocale).demoMode.cannotEditRealData
          : err instanceof Error ? err.message : "Ошибка сохранения",
      );
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-semibold text-gray-600";

  // No subjects assigned to this teacher at all
  if (teacherSubjects.length === 0) {
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D1D1F]">Новый урок</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-zinc-600">{d.createNoSubjects}</p>
            <button onClick={onClose} className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Закрыть</button>
          </div>
        </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="text-lg font-bold text-[#1D1D1F]">
              {mode === "create" ? "Новый урок" : "Редактировать урок"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
            <div>
              <label className={labelCls}>Группа *</label>
              <select
                value={form.groupId}
                onChange={e => { set("groupId", e.target.value); set("subjectId", ""); }}
                className={inputCls}
              >
                <option value="">Выберите группу</option>
                {(groupsWithSubjects.length > 0 ? groupsWithSubjects : groups).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            {form.groupId && (
              <div>
                <label className={labelCls}>{d.createSelectSubject} *</label>
                {groupSubjects.length === 0 ? (
                  <p className="text-xs text-amber-600 mt-1">{d.createNoSubjects}</p>
                ) : (
                  <select value={form.subjectId} onChange={e => set("subjectId", e.target.value)} className={inputCls}>
                    <option value="">— выберите предмет —</option>
                    {groupSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
                {/* Смена предмета у урока, за который уже стоят оценки. Не
                    запрещаем: отличить исправленную опечатку от переноса
                    истории может только человек. Показываем, сколько оценок
                    поедет, и оставляем решение ему. */}
                {предупредить && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {d.editSubjectHasGrades.replace("{n}", String(оценокУУрока))}
                  </p>
                )}
              </div>
            )}
            {mode === "create" && planTopics && planTopics.length > 0 && (
              <div>
                <label className={labelCls}>{dc.topicFromPlan}</label>
                <select
                  value={useCustomTopic ? "__custom__" : form.curriculumTopicId}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setUseCustomTopic(true);
                      set("curriculumTopicId", "");
                    } else {
                      setUseCustomTopic(false);
                      set("curriculumTopicId", e.target.value);
                      const topic = planTopics.find((t) => t.id === e.target.value);
                      if (topic) set("title", topic.title);
                    }
                  }}
                  className={inputCls}
                >
                  <option value="" disabled>— выберите тему —</option>
                  {planTopics.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      {i + 1}. {t.title} ({t.used_in_lessons > 0 ? `использована в ${t.used_in_lessons} уроках` : "не использована"})
                    </option>
                  ))}
                  <option value="__custom__">{dc.enterCustomTopic}</option>
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Дата *</label>
              <DatePickerField value={form.date} onChange={v => set("date", v)} inputCls={inputCls} minToday />
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <Clock className="h-3.5 w-3.5" /> Время начала *
              </label>
              <IosTimePicker value={form.startTime} onChange={v => set("startTime", v)} minDate={form.date} />
            </div>
            {/* ДЛИТЕЛЬНОСТИ ЗДЕСЬ БОЛЬШЕ НЕТ (01.09.2026, миграция 246).
                Её задаёт суперадмин в карточке школы — одно число на всех, и
                спрашивать его у предметника незачем: сетка звонков в школе одна.
                Новый урок берёт длительность у школы сам (createLesson), у
                существующего своё время начала и конца уже записано. */}
            <div>
              <label className={labelCls}>Кабинет</label>
              <input type="text" value={form.room} onChange={e => set("room", e.target.value)} placeholder="например: 305" className={inputCls} />
            </div>
            {(mode !== "create" || !planTopics || planTopics.length === 0 || useCustomTopic) && (
              <div>
                <label className={labelCls}>Название урока (опционально)</label>
                <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Например: Циклы в Python" className={inputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>Описание / цель (опционально)</label>
              <textarea rows={2} value={form.desc} onChange={e => set("desc", e.target.value)} placeholder="Что ученики должны узнать" className={`${inputCls} resize-none`} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50">
                {saving ? "Сохраняем…" : mode === "create" ? "Создать урок" : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────
function DeleteModal({ lesson, onClose, onConfirm }: {
  lesson: LessonItem; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const title = lesson.title ?? lesson.topic ?? fmtDate(lesson.starts_at);
  async function handleConfirm() {
    setDeleting(true);
    try { await onConfirm(); } catch { setDeleting(false); }
  }
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F]">Удалить урок?</h3>
              <p className="mt-1 text-sm text-gray-500">«{title}» — удалит все связанные материалы. Необратимо.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Отмена
            </button>
            <button onClick={handleConfirm} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50">
              {deleting ? "Удаляем…" : "Удалить"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function TeacherLessonsView({
  lessons: initialLessons,
  groups,
  teacherSubjects,
  loadError = false,
}: {
  lessons: LessonItem[];
  groups: GroupItem[];
  teacherSubjects: SubjectWithGroup[];
  loadError?: boolean;
  // 30.08.2026 — пропа isCurator здесь больше нет. Он прятал создание урока
  // и меню карточек у наблюдателя; роль убрана из продукта, прятать не от кого.
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const dc = getDictionary(defaultLocale).common;
  // Массовое создание — по языку пользователя, а не по языку по умолчанию.
  const { locale: uiLocale } = useLocale();
  const dt = getDictionary(uiLocale as Locale).teacher;
  const dbRef = useRef(createClient());
  const db = dbRef.current;

  // Z.3, заход 3 — «сейчас» школы. У замороженной школы таймер не заводится,
  // значение неподвижно: подсветка «Сейчас» в расписании не уезжает.
  const now = useSchoolNow(30_000);
  const schoolNowMs = useSchoolNowSnapshot();
  const todayKey = tashkentDayKey(now);

  // 26.08.2026: начальный месяц — ташкентский. Было getFullYear()/getMonth():
  // учитель, открывший расписание в 01:00 первого числа, попадал на прошлый
  // месяц и видел пустой список.
  const nowParts = tashkentParts(now);
  const [viewYear, setViewYear] = useState(nowParts.year);
  const [viewMonth, setViewMonth] = useState(nowParts.month); // 1-based
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [monthLessons, setMonthLessons] = useState<LessonItem[]>(() => {
    const { startIso, endIso } = tashkentMonthBoundsUtc(nowParts.year, nowParts.month);
    const start = new Date(startIso);
    const end = new Date(endIso);
    return initialLessons.filter(l => {
      const d = new Date(l.starts_at);
      return d >= start && d <= end;
    });
  });
  const [loading, setLoading] = useState(false);

  const [formModal, setFormModal] = useState<"create" | "edit" | null>(null);
  // Массовое создание — отдельное окно: правило на период, а не один урок.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<LessonItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonItem | null>(null);

  // Учебные планы, Часть 2В — "Использовать как заготовки": переход сюда с
  // ?newLesson=1&groupId=&subjectId= из карточки плана открывает форму
  // создания урока с уже выбранными группой/предметом — дропдаун тем плана
  // (в LessonFormModal) подхватывает их сам по (groupId, subjectId), больше
  // ничего не нужно.
  const [presetGroupSubject, setPresetGroupSubject] = useState<{ groupId: string; subjectId: string } | null>(null);
  useEffect(() => {
    if (searchParams.get("newLesson") !== "1") return;
    const groupId = searchParams.get("groupId") ?? "";
    const subjectId = searchParams.get("subjectId") ?? "";
    if (!groupId) return;
    setPresetGroupSubject({ groupId, subjectId });
    setEditLesson(null);
    setFormModal("create");
    router.replace("/teacher/lessons", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mountedRef = useRef(false);

  // Gate the calendar until after mount: Vercel renders in UTC, client in local TZ,
  // so the initial month / "today" cell can differ and trigger hydration error #418.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function loadMonth(year: number, month: number) {
    setLoading(true);
    try {
      const data = await getTeacherLessonsByMonth(db, year, month);
      setMonthLessons(data as unknown as LessonItem[]);
    } catch (e) {
      console.error("[TeacherLessonsView] loadMonth failed:", (e as Error)?.message ?? e);
      toast(dc.error);
    }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    void loadMonth(viewYear, viewMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const byDay = new Map<string, LessonItem[]>();
  for (const l of monthLessons) {
    const key = lessonDateKey(l.starts_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(l);
  }

  const calendarDays = getCalendarGrid(viewYear, viewMonth);

  const dayLessons = (byDay.get(selectedDayKey) ?? []).slice().sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  function openCreate() { setEditLesson(null); setFormModal("create"); }
  function openEdit(l: LessonItem)   { setEditLesson(l); setFormModal("edit"); }
  function openDelete(l: LessonItem) { setDeleteTarget(l); }

  async function handleSave(form: FormState) {
    const startsAt = buildIso(form.date, form.startTime);
    if (formModal === "create") {
      // 26.08.2026, миграция 226: у урока обязан быть предмет. Селектор
      // предмета в форме обязателен и при одном предмете в группе
      // проставляется сам, так что сюда пустое значение приходит только при
      // обходе формы — но отказ должен быть внятным, а не текстом Postgres
      // про not-null constraint.
      if (!form.subjectId) throw new Error("Выберите предмет урока");
      const created = await createLesson(db, {
        groupId: form.groupId, startsAt,
        room: form.room || null, title: form.title || null, description: form.desc || null,
        subjectId: form.subjectId,
        curriculumTopicId: form.curriculumTopicId || null,
      }, schoolNowMs());
      setFormModal(null);
      router.push(`/teacher/lessons/${created.id}`);
    } else if (formModal === "edit" && editLesson) {
      await updateLesson(db, editLesson.id, {
        group_id: form.groupId, starts_at: startsAt,
        room: form.room || null, title: form.title || null, description: form.desc || null,
        // 30.08.2026 (пункт 78). Без этой строки перенос урока в другую
        // группу оставлял предмет СТАРОЙ группы: урок в 7-А с английским
        // из 10-А. База такое пропускает — ограничения «предмет принадлежит
        // группе урока» в схеме нет. Список предметов в форме сужен по
        // выбранной группе, поэтому через интерфейс рассогласовать больше
        // нечем.
        subject_id: form.subjectId,
      }, schoolNowMs());
      setFormModal(null);
      await loadMonth(viewYear, viewMonth);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteLesson(db, deleteTarget.id);
    setDeleteTarget(null);
    await loadMonth(viewYear, viewMonth);
  }

  return (
    <PageContainer className="space-y-6">
      {loadError && <ErrorState>{dc.error}</ErrorState>}
      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* ── LEFT: Calendar ── */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">

            {/* Month nav */}
            <div className="mb-5 flex items-center justify-between">
              <button onClick={prevMonth} className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-base font-bold text-[#1D1D1F]">
                {MONTHS_RU[viewMonth - 1]} {viewYear}
                {loading && <span className="ml-2 text-[11px] font-normal text-gray-400">обновляем…</span>}
              </h2>
              <button onClick={nextMonth} className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map(wd => (
                <div key={wd} className="text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {wd}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                const key = tashkentDayKey(day);
                const isCurrentMonth = day.getUTCMonth() === viewMonth - 1;
                const isToday    = key === todayKey;
                const isSelected = key === selectedDayKey;
                const dayData    = byDay.get(key) ?? [];
                const aggStatus  = aggregateDayStatus(dayData);

                let cellCls =
                  "relative flex flex-col items-center rounded-xl p-1 transition-all hover:scale-105 cursor-pointer min-h-[52px] ";
                if (isSelected) {
                  cellCls += "bg-blue-500 shadow-md shadow-blue-400/30 ";
                } else if (aggStatus) {
                  cellCls += DAY_BG[aggStatus] + " ";
                } else {
                  cellCls += "hover:bg-gray-50 ";
                }
                if (isToday && !isSelected) cellCls += "ring-2 ring-blue-400 ring-offset-1 ";

                return (
                  <button
                    key={i}
                    onClick={() => {
                      // Сетка — всегда 42 ячейки (6 недель), поэтому у месяцев,
                      // начинающихся не с понедельника, хвост неизбежно
                      // захватывает дни СЛЕДУЮЩЕГО месяца (напр. июль 2026
                      // начинается в четверг — хвост сетки доходит до 8
                      // августа). Раньше клик по такой "серой" ячейке менял
                      // только selectedDayKey — viewYear/viewMonth оставались
                      // прежними, monthLessons (и, соответственно, точки/
                      // список уроков) для этого дня никогда не подгружались.
                      // Баг проявлялся как "нет уроков" на 1-2 августа при
                      // просмотре июля.
                      if (!isCurrentMonth) {
                        setViewYear(day.getUTCFullYear());
                        setViewMonth(day.getUTCMonth() + 1);
                      }
                      setSelectedDayKey(key);
                    }}
                    className={cellCls}
                  >
                    <span className={`mt-1 text-sm font-semibold leading-none ${
                      isSelected ? "text-white"
                      : isCurrentMonth ? "text-[#1D1D1F]"
                      : "text-gray-300"
                    }`}>
                      {day.getUTCDate()}
                    </span>
                    {/* Per-lesson dots with individual effective-status colours */}
                    {dayData.length > 0 && (
                      <div className="mt-1.5 flex items-center justify-center gap-0.5">
                        {dayData.slice(0, 3).map((l, di) => {
                          const eff = getEffectiveStatus(l);
                          return (
                            <span key={di} className={`h-1.5 w-1.5 rounded-full ${
                              isSelected ? "bg-white/80" : EFF_DOT[eff]
                            }`} />
                          );
                        })}
                        {dayData.length > 3 && (
                          <span className={`text-[9px] font-bold leading-none ${
                            isSelected ? "text-white/70" : "text-gray-400"
                          }`}>
                            +{dayData.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              {(
                [
                  ["in_progress", "Идёт сейчас"],
                  ["scheduled",   "Запланирован"],
                  ["completed",   "Завершён"],
                ] as [EffectiveStatus, string][]
              ).map(([s, label]) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${EFF_DOT[s]}`} />
                  <span className="text-[11px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Day panel ── */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">

            {/* Day header + create button */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold capitalize text-[#1D1D1F]">
                {fmtDayHeader(selectedDayKey)}
              </h3>
              {(
                <div className="flex shrink-0 items-center gap-2">
                  {/* Уроки в школе повторяются неделя за неделей — правило на
                      период вместо сотни отдельных нажатий на четверть. */}
                  <button
                    onClick={() => setBulkOpen(true)}
                    className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <CalendarRange className="h-3.5 w-3.5" /> {dt.bulkBtn}
                  </button>
                  <button
                    onClick={openCreate}
                    className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" /> Создать урок
                  </button>
                </div>
              )}
            </div>

            {/* Lesson list or empty state */}
            {dayLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                  <CalendarDays className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">На этот день уроков нет</p>
                {(
                  <button
                    onClick={openCreate}
                    className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    + Создать урок
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {dayLessons.map(l => (
                  <LessonCard key={l.id} lesson={l} onEdit={openEdit} onDelete={openDelete} readOnly={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {bulkOpen && (
        <BulkLessonsModal
          groups={groups}
          teacherSubjects={teacherSubjects}
          onClose={() => setBulkOpen(false)}
          onCreated={() => { void loadMonth(viewYear, viewMonth); }}
        />
      )}

      {formModal && (
        <LessonFormModal
          mode={formModal}
          groups={groups}
          teacherSubjects={teacherSubjects}
          initial={
            formModal === "edit" && editLesson
              ? lessonToForm(editLesson)
              : presetGroupSubject
                ? { ...emptyForm(presetGroupSubject.groupId), subjectId: presetGroupSubject.subjectId }
                : emptyForm(groups[0]?.id ?? "")
          }
          editLessonId={formModal === "edit" ? editLesson?.id : undefined}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          lesson={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </PageContainer>
  );
}
