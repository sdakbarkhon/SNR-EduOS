"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays, MapPin, Clock, Plus, MoreHorizontal,
  Pencil, Trash2, X, AlertTriangle,
} from "lucide-react";
import { getSubjectStyle, createLesson, updateLesson, deleteLesson } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

type GroupItem = { id: string; name: string; subject: string };

type LessonItem = {
  id: string;
  group_id: string;
  lesson_no: number | null;
  topic: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  group: { id: string; name: string; subject: string };
};

type FormState = {
  groupId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  title: string;
  desc: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function isFuture(iso: string): boolean {
  return new Date(iso) > new Date(new Date().setHours(23, 59, 59, 999));
}
function isPast(iso: string): boolean {
  return new Date(iso) < new Date(new Date().setHours(0, 0, 0, 0));
}
function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sv"); // sv locale gives YYYY-MM-DD
}
function toLocalTimeStr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function buildIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function emptyForm(groupId = ""): FormState {
  return { groupId, date: "", startTime: "", endTime: "", room: "", title: "", desc: "" };
}
function lessonToForm(l: LessonItem): FormState {
  return {
    groupId: l.group_id,
    date: toLocalDateStr(l.starts_at),
    startTime: toLocalTimeStr(l.starts_at),
    endTime: l.ends_at ? toLocalTimeStr(l.ends_at) : "",
    room: l.room ?? "",
    title: l.title ?? "",
    desc: "",
  };
}

// ── Card menu (•••) ─────────────────────────────────────────────────────────
function CardMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Редактировать
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Удалить
          </button>
        </div>
      )}
    </div>
  );
}

// ── Lesson card ──────────────────────────────────────────────────────────────
function LessonCard({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: LessonItem;
  onEdit: (l: LessonItem) => void;
  onDelete: (l: LessonItem) => void;
}) {
  const style = getSubjectStyle(lesson.group.subject);
  const displayTitle = lesson.title ?? lesson.topic ?? fmtDate(lesson.starts_at);
  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-white bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/teacher/lessons/${lesson.id}`} className="flex flex-1 items-center gap-4 min-w-0">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white text-xl"
          style={{ background: style.color }}
        >
          {style.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#1D1D1F]">{displayTitle}</p>
          <p className="text-xs text-gray-500">{lesson.group.name} · {style.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeRange}</span>
            {lesson.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Каб. {lesson.room}</span>}
          </div>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{fmtDate(lesson.starts_at)}</span>
      </Link>
      <CardMenu onEdit={() => onEdit(lesson)} onDelete={() => onDelete(lesson)} />
    </div>
  );
}

function Section({
  title,
  lessons,
  onEdit,
  onDelete,
}: {
  title: string;
  lessons: LessonItem[];
  onEdit: (l: LessonItem) => void;
  onDelete: (l: LessonItem) => void;
}) {
  if (lessons.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h2>
      <div className="space-y-2">
        {lessons.map((l) => (
          <LessonCard key={l.id} lesson={l} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

// ── Create/Edit form modal ───────────────────────────────────────────────────
function LessonFormModal({
  mode,
  groups,
  initial,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  groups: GroupItem[];
  initial: FormState;
  onClose: () => void;
  onSave: (f: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof FormState, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groupId) { setError("Выберите группу"); return; }
    if (!form.date) { setError("Укажите дату"); return; }
    if (!form.startTime) { setError("Укажите время начала"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-semibold text-gray-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
          {/* Group */}
          <div>
            <label className={labelCls}>Группа *</label>
            <select
              value={form.groupId}
              onChange={(e) => set("groupId", e.target.value)}
              className={inputCls}
            >
              <option value="">Выберите группу</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>Дата *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Начало *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Конец</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className={labelCls}>Кабинет</label>
            <input
              type="text"
              value={form.room}
              onChange={(e) => set("room", e.target.value)}
              placeholder="например: 305"
              className={inputCls}
            />
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Название урока (опционально)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Например: Циклы в Python"
              className={inputCls}
            />
          </div>

          {/* Desc */}
          <div>
            <label className={labelCls}>Описание / цель (опционально)</label>
            <textarea
              rows={2}
              value={form.desc}
              onChange={(e) => set("desc", e.target.value)}
              placeholder="Что ученики должны узнать"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            >
              {saving ? "Сохраняем…" : mode === "create" ? "Создать урок" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({
  lesson,
  onClose,
  onConfirm,
}: {
  lesson: LessonItem;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const title = lesson.title ?? lesson.topic ?? fmtDate(lesson.starts_at);

  async function handleConfirm() {
    setDeleting(true);
    try { await onConfirm(); } catch { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F]">Удалить урок?</h3>
            <p className="mt-1 text-sm text-gray-500">
              «{title}» — это удалит все связанные материалы и заметки. Действие необратимо.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
          >
            {deleting ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export function TeacherLessonsView({
  lessons,
  groups,
}: {
  lessons: LessonItem[];
  groups: GroupItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const db = createClient();

  const [formModal, setFormModal] = useState<"create" | "edit" | null>(null);
  const [editLesson, setEditLesson] = useState<LessonItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonItem | null>(null);

  const todayLessons = lessons.filter((l) => isToday(l.starts_at));
  const upcoming = lessons.filter((l) => isFuture(l.starts_at)).sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const past = lessons.filter((l) => isPast(l.starts_at));

  function openCreate() {
    setEditLesson(null);
    setFormModal("create");
  }
  function openEdit(l: LessonItem) {
    setEditLesson(l);
    setFormModal("edit");
  }
  function openDelete(l: LessonItem) {
    setDeleteTarget(l);
  }

  async function handleSave(form: FormState) {
    const startsAt = buildIso(form.date, form.startTime);
    const endsAt = form.endTime ? buildIso(form.date, form.endTime) : null;

    if (formModal === "create") {
      const created = await createLesson(db, {
        groupId: form.groupId,
        startsAt,
        endsAt,
        room: form.room || null,
        title: form.title || null,
        description: form.desc || null,
      });
      setFormModal(null);
      router.push(`/teacher/lessons/${created.id}`);
    } else if (formModal === "edit" && editLesson) {
      await updateLesson(db, editLesson.id, {
        group_id: form.groupId,
        starts_at: startsAt,
        ends_at: endsAt,
        room: form.room || null,
        title: form.title || null,
        description: form.desc || null,
      });
      setFormModal(null);
      startTransition(() => router.refresh());
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteLesson(db, deleteTarget.id);
    setDeleteTarget(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1D1D1F]">Уроки</h1>
            <p className="text-sm text-gray-500">{lessons.length} уроков в ваших группах</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Создать урок
        </button>
      </div>

      {/* Lesson list */}
      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">Уроков нет</p>
          <button
            onClick={openCreate}
            className="mt-4 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            + Создать первый урок
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Сегодня" lessons={todayLessons} onEdit={openEdit} onDelete={openDelete} />
          <Section title="Предстоящие" lessons={upcoming} onEdit={openEdit} onDelete={openDelete} />
          <Section title="Прошедшие" lessons={past} onEdit={openEdit} onDelete={openDelete} />
        </div>
      )}

      {/* Modals */}
      {formModal && (
        <LessonFormModal
          mode={formModal}
          groups={groups}
          initial={formModal === "edit" && editLesson ? lessonToForm(editLesson) : emptyForm(groups[0]?.id ?? "")}
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
