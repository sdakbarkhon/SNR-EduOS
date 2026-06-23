"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Plus,
  MoreHorizontal, Pencil, Trash2, X, AlertTriangle, CalendarDays,
} from "lucide-react";
import {
  getSubjectStyle, createLesson, updateLesson, deleteLesson,
  getTeacherLessonsByMonth,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────
type GroupItem = { id: string; name: string; subject: string };
type LessonItem = {
  id: string; group_id: string; lesson_no: number | null;
  topic: string | null; title: string | null;
  starts_at: string; ends_at: string | null; room: string | null;
  status: string; started_at: string | null; ended_at: string | null;
  group: { id: string; name: string; subject: string };
};
type FormState = {
  groupId: string; date: string; startTime: string;
  durationMinutes: string; room: string; title: string; desc: string;
};
type EffectiveStatus = "scheduled" | "in_progress" | "completed" | "missed";
type DayStatus = "in_progress" | "overdue" | "completed" | "scheduled" | null;

// ── Effective status ──────────────────────────────────────────────────────────
function getEffectiveStatus(lesson: LessonItem, now: Date): EffectiveStatus {
  if (lesson.status === "in_progress") return "in_progress";
  if (lesson.status === "completed")   return "completed";
  if (lesson.status === "scheduled" && new Date(lesson.starts_at) < now) return "missed";
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
  missed:      { label: "Пропущен",   cls: "bg-red-100 text-red-700 border border-red-200" },
};
// Card background (soft fill)
const EFF_CARD_BG: Record<EffectiveStatus, string> = {
  scheduled:   "bg-blue-50",
  in_progress: "bg-yellow-50",
  completed:   "bg-emerald-50",
  missed:      "bg-red-50",
};
// Left border colour
const EFF_BORDER: Record<EffectiveStatus, string> = {
  scheduled:   "border-l-blue-400",
  in_progress: "border-l-yellow-400",
  completed:   "border-l-emerald-400",
  missed:      "border-l-red-400",
};
// Dot colour (used both in legend and in calendar cells)
const EFF_DOT: Record<EffectiveStatus, string> = {
  scheduled:   "bg-blue-400",
  in_progress: "bg-yellow-400",
  completed:   "bg-emerald-400",
  missed:      "bg-red-400",
};

// Calendar cell background (aggregate)
const DAY_BG: Record<NonNullable<DayStatus>, string> = {
  in_progress: "bg-yellow-50/70 border border-yellow-200",
  overdue:     "bg-red-50/70 border border-red-200",
  completed:   "bg-emerald-50/70 border border-emerald-200",
  scheduled:   "bg-blue-50/70 border border-blue-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function lessonDateKey(iso: string): string { return localDateKey(new Date(iso)); }

function getCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1);
  let dow = firstDay.getDay();
  dow = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
  const days: Date[] = [];
  const start = new Date(year, month - 1, 1 - dow);
  for (let i = 0; i < 42; i++)
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return days;
}

function aggregateDayStatus(dayLessons: LessonItem[], now: Date): DayStatus {
  if (dayLessons.length === 0) return null;
  if (dayLessons.some(l => l.status === "in_progress")) return "in_progress";
  if (dayLessons.some(l => l.status === "scheduled" && new Date(l.starts_at) < now)) return "overdue";
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
function toLocalDateStr(iso: string): string { return localDateKey(new Date(iso)); }
function toLocalTimeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" });
}
function buildIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
function emptyForm(groupId = ""): FormState {
  return { groupId, date: "", startTime: "", durationMinutes: "45", room: "", title: "", desc: "" };
}
function lessonToForm(l: LessonItem): FormState {
  return {
    groupId: l.group_id,
    date: toLocalDateStr(l.starts_at),
    startTime: toLocalTimeStr(l.starts_at),
    durationMinutes: "45",
    room: l.room ?? "", title: l.title ?? "", desc: "",
  };
}

// ── CardMenu ──────────────────────────────────────────────────────────────────
function CardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Редактировать
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
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
  lesson, now, onEdit, onDelete,
}: {
  lesson: LessonItem; now: Date;
  onEdit: (l: LessonItem) => void; onDelete: (l: LessonItem) => void;
}) {
  const style = getSubjectStyle(lesson.group.subject);
  const displayTitle = lesson.title ?? lesson.topic ?? fmtDate(lesson.starts_at);
  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);
  const eff = getEffectiveStatus(lesson, now);
  const badge = EFF_BADGE[eff];

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-white/60 p-3 pl-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 ${EFF_CARD_BG[eff]} ${EFF_BORDER[eff]}`}>
      <Link href={`/teacher/lessons/${lesson.id}`} className="flex flex-1 items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ background: style.color }}
        >
          {style.emoji}
        </div>
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
      <CardMenu onEdit={() => onEdit(lesson)} onDelete={() => onDelete(lesson)} />
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
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${day}`);
              setOpen(false);
            }}
            disabled={minToday ? { before: new Date(new Date().setHours(0, 0, 0, 0)) } : undefined}
          />
        </div>
      )}
    </div>
  );
}

// ── LessonFormModal ───────────────────────────────────────────────────────────
function LessonFormModal({
  mode, groups, initial, onClose, onSave,
}: {
  mode: "create" | "edit"; groups: GroupItem[]; initial: FormState;
  onClose: () => void; onSave: (f: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof FormState, val: string) { setForm(p => ({ ...p, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groupId)   { setError("Выберите группу"); return; }
    if (!form.date)      { setError("Укажите дату"); return; }
    if (!form.startTime) { setError("Укажите время начала"); return; }
    setSaving(true); setError("");
    try { await onSave(form); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Ошибка сохранения"); setSaving(false); }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-semibold text-gray-600";

  return (
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
            <select value={form.groupId} onChange={e => set("groupId", e.target.value)} className={inputCls}>
              <option value="">Выберите группу</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Дата *</label>
            <DatePickerField value={form.date} onChange={v => set("date", v)} inputCls={inputCls} minToday />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Начало *</label>
              <input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Длительность (мин.)</label>
              <input type="number" min="5" max="240" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Кабинет</label>
            <input type="text" value={form.room} onChange={e => set("room", e.target.value)} placeholder="например: 305" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Название урока (опционально)</label>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Например: Циклы в Python" className={inputCls} />
          </div>
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
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function TeacherLessonsView({
  lessons: initialLessons,
  groups,
}: {
  lessons: LessonItem[];
  groups: GroupItem[];
}) {
  const router = useRouter();
  const dbRef = useRef(createClient());
  const db = dbRef.current;

  const now = new Date();
  const todayKey = localDateKey(now);

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-based
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [monthLessons, setMonthLessons] = useState<LessonItem[]>(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return initialLessons.filter(l => {
      const d = new Date(l.starts_at);
      return d >= start && d <= end;
    });
  });
  const [loading, setLoading] = useState(false);

  const [formModal, setFormModal] = useState<"create" | "edit" | null>(null);
  const [editLesson, setEditLesson] = useState<LessonItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonItem | null>(null);

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
    } catch (e) { console.error(e); }
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
    const durationMinutes = Math.max(5, Math.min(240, parseInt(form.durationMinutes, 10) || 45));
    if (formModal === "create") {
      const created = await createLesson(db, {
        groupId: form.groupId, startsAt, durationMinutes,
        room: form.room || null, title: form.title || null, description: form.desc || null,
      });
      setFormModal(null);
      router.push(`/teacher/lessons/${created.id}`);
    } else if (formModal === "edit" && editLesson) {
      await updateLesson(db, editLesson.id, {
        group_id: form.groupId, starts_at: startsAt, duration_minutes: durationMinutes,
        room: form.room || null, title: form.title || null, description: form.desc || null,
      });
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
    <div className="mx-auto max-w-7xl space-y-6">
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
                const key = localDateKey(day);
                const isCurrentMonth = day.getMonth() === viewMonth - 1;
                const isToday    = key === todayKey;
                const isSelected = key === selectedDayKey;
                const dayData    = byDay.get(key) ?? [];
                const aggStatus  = aggregateDayStatus(dayData, now);

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
                  <button key={i} onClick={() => setSelectedDayKey(key)} className={cellCls}>
                    <span className={`mt-1 text-sm font-semibold leading-none ${
                      isSelected ? "text-white"
                      : isCurrentMonth ? "text-[#1D1D1F]"
                      : "text-gray-300"
                    }`}>
                      {day.getDate()}
                    </span>
                    {/* Per-lesson dots with individual effective-status colours */}
                    {dayData.length > 0 && (
                      <div className="mt-1.5 flex items-center justify-center gap-0.5">
                        {dayData.slice(0, 3).map((l, di) => {
                          const eff = getEffectiveStatus(l, now);
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
                  ["missed",      "Пропущен"],
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
              <button
                onClick={openCreate}
                className="flex shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" /> Создать урок
              </button>
            </div>

            {/* Lesson list or empty state */}
            {dayLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                  <CalendarDays className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">На этот день уроков нет</p>
                <button
                  onClick={openCreate}
                  className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  + Создать урок
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dayLessons.map(l => (
                  <LessonCard key={l.id} lesson={l} now={now} onEdit={openEdit} onDelete={openDelete} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {formModal && (
        <LessonFormModal
          mode={formModal}
          groups={groups}
          initial={
            formModal === "edit" && editLesson
              ? lessonToForm(editLesson)
              : emptyForm(groups[0]?.id ?? "")
          }
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
    </div>
  );
}
