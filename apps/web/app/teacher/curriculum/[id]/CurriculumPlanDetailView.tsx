"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronUp, ChevronDown, Pencil, Trash2, Check,
  Sparkles, ListPlus, LayoutTemplate, AlertTriangle, CalendarPlus,
} from "lucide-react";
import {
  getCurriculumTopicsWithUsage, updateCurriculumPlanTopic,
  reorderCurriculumPlanTopics, deleteCurriculumPlanTopic, createLesson,
} from "@snr/core";
import type { CurriculumPlanWithTopics, CurriculumTopicWithUsage } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

function topicWord(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "тема";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "темы";
  return "тем";
}

type GenerateLessonsResult = {
  created: number;
  skipped?: number;
  lessons?: Array<{ topicId: string; title: string; date: string; time: string }>;
  message?: string;
  error?: string;
};

export function CurriculumPlanDetailView({
  plan,
  teacherId,
}: {
  plan: CurriculumPlanWithTopics;
  teacherId: string;
}) {
  const db = createClient();
  const isOwner = plan.teacher_id === teacherId;

  const [topics, setTopics] = useState<CurriculumTopicWithUsage[]>(
    plan.topics.map((t) => ({ ...t, used_in_lessons: 0 })),
  );
  const [usageLoaded, setUsageLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurriculumTopicsWithUsage(db, plan.id)
      .then((withUsage) => { if (!cancelled) { setTopics(withUsage); setUsageLoaded(true); } })
      .catch(() => { if (!cancelled) setUsageLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  // ── Rename (inline) ──────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function startEdit(t: CurriculumPlanWithTopics["topics"][number]) {
    setEditingId(t.id);
    setEditValue(t.title);
    setRowError(null);
  }
  async function commitEdit(topicId: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;
    const prev = topics;
    setTopics((cur) => cur.map((t) => (t.id === topicId ? { ...t, title: trimmed } : t)));
    try {
      await updateCurriculumPlanTopic(db, topicId, { title: trimmed });
    } catch (e) {
      setTopics(prev);
      setRowError({ id: topicId, message: e instanceof Error ? e.message : "Не удалось сохранить" });
    }
  }

  // ── Reorder ───────────────────────────────────────────────────────────────
  const [reordering, setReordering] = useState(false);
  async function moveTopic(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= topics.length || reordering) return;
    const prev = topics;
    const next = [...topics];
    const a = next[index]!, b = next[newIndex]!;
    next[index] = b; next[newIndex] = a;
    setTopics(next);
    setReordering(true);
    try {
      await reorderCurriculumPlanTopics(db, next.map((t) => t.id));
    } catch (e) {
      setTopics(prev);
      setRowError({ id: a.id, message: e instanceof Error ? e.message : "Не удалось переставить" });
    } finally {
      setReordering(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<CurriculumTopicWithUsage | null>(null);
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCurriculumPlanTopic(db, confirmDelete.id);
      setTopics((cur) => cur.filter((t) => t.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      setRowError({ id: confirmDelete.id, message: e instanceof Error ? e.message : "Не удалось удалить" });
    } finally {
      setDeleting(false);
    }
  }

  // ── Часть 2А: создать все уроки автоматически ───────────────────────────
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoResult, setAutoResult] = useState<GenerateLessonsResult | null>(null);
  async function handleAutoCreate() {
    setAutoCreating(true);
    setAutoResult(null);
    try {
      const res = await fetch(`/api/curriculum-plans/${plan.id}/generate-lessons`, { method: "POST" });
      const json = (await res.json()) as GenerateLessonsResult;
      setAutoResult(json);
      if (res.ok) {
        const fresh = await getCurriculumTopicsWithUsage(db, plan.id).catch(() => null);
        if (fresh) setTopics(fresh);
      }
    } catch {
      setAutoResult({ created: 0, error: "Ошибка сети" });
    } finally {
      setAutoCreating(false);
    }
  }

  // ── Часть 2Б: создать по одному ─────────────────────────────────────────
  const [oneByOneMode, setOneByOneMode] = useState(false);
  const [oneByOneDraft, setOneByOneDraft] = useState<Record<string, { date: string; time: string }>>({});
  const [oneByOneBusy, setOneByOneBusy] = useState<string | null>(null);
  const [oneByOneError, setOneByOneError] = useState<{ id: string; message: string } | null>(null);

  function setDraft(topicId: string, patch: Partial<{ date: string; time: string }>) {
    setOneByOneDraft((cur) => ({ ...cur, [topicId]: { date: cur[topicId]?.date ?? "", time: cur[topicId]?.time ?? "", ...patch } }));
  }
  async function handleCreateOne(t: CurriculumTopicWithUsage) {
    const draft = oneByOneDraft[t.id];
    if (!draft?.date || !draft?.time) {
      setOneByOneError({ id: t.id, message: "Укажите дату и время" });
      return;
    }
    setOneByOneBusy(t.id);
    setOneByOneError(null);
    try {
      await createLesson(db, {
        groupId: plan.group_id,
        startsAt: `${draft.date}T${draft.time}:00+05:00`,
        durationMinutes: 45,
        room: "Кабинет 101",
        title: t.title,
        description: t.description,
        subjectId: plan.subject_id,
        curriculumTopicId: t.id,
      });
      setTopics((cur) => cur.map((x) => (x.id === t.id ? { ...x, used_in_lessons: x.used_in_lessons + 1 } : x)));
    } catch (e) {
      setOneByOneError({ id: t.id, message: e instanceof Error ? e.message : "Не удалось создать урок" });
    } finally {
      setOneByOneBusy(null);
    }
  }

  const inputCls = "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/teacher/curriculum" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Учебные планы
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{plan.subject_name}</p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">{plan.group_name}</h1>
            <p className="mt-1 text-sm text-slate-500">{topics.length} {topicWord(topics.length)}</p>
          </div>
        </div>
      </div>

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Этот план принадлежит другому учителю — доступен только просмотр.
        </div>
      )}

      {/* Часть 1 — список тем */}
      <div className="space-y-2">
        {topics.map((t, i) => (
          <div key={t.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {editingId === t.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => commitEdit(t.id)}
                      className="w-full rounded-lg border border-blue-300 px-2.5 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => commitEdit(t.id)} className="shrink-0 text-emerald-500 hover:text-emerald-600">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => isOwner && startEdit(t)}
                    disabled={!isOwner}
                    className="flex items-center gap-1.5 text-left text-sm font-semibold text-slate-900 disabled:cursor-default"
                  >
                    {t.title}
                    {isOwner && <Pencil className="h-3 w-3 shrink-0 text-slate-300" />}
                  </button>
                )}
                {t.description && <p className="mt-1 text-xs text-slate-500">{t.description}</p>}
                <div className="mt-1.5 flex items-center gap-2">
                  {t.used_in_lessons > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Урок создан{t.used_in_lessons > 1 ? ` (${t.used_in_lessons})` : ""}
                    </span>
                  ) : usageLoaded && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      Урок не создан
                    </span>
                  )}
                </div>
                {rowError?.id === t.id && <p className="mt-1 text-[11px] text-red-500">{rowError.message}</p>}

                {oneByOneMode && isOwner && t.used_in_lessons === 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-100 pt-2.5">
                    <input
                      type="date"
                      value={oneByOneDraft[t.id]?.date ?? ""}
                      onChange={(e) => setDraft(t.id, { date: e.target.value })}
                      className={inputCls}
                    />
                    <input
                      type="time"
                      value={oneByOneDraft[t.id]?.time ?? ""}
                      onChange={(e) => setDraft(t.id, { time: e.target.value })}
                      className={inputCls}
                    />
                    <button
                      onClick={() => handleCreateOne(t)}
                      disabled={oneByOneBusy === t.id}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      {oneByOneBusy === t.id ? "Создаём…" : "Создать урок"}
                    </button>
                    {oneByOneError?.id === t.id && <span className="text-[11px] text-red-500">{oneByOneError.message}</span>}
                  </div>
                )}
              </div>
              {isOwner && editingId !== t.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => moveTopic(i, -1)} disabled={i === 0 || reordering} className="rounded-lg p-1 text-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveTopic(i, 1)} disabled={i === topics.length - 1 || reordering} className="rounded-lg p-1 text-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(t)} className="rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Часть 2 — три способа создания уроков */}
      {isOwner && (
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Создать уроки из тем плана</h2>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              onClick={handleAutoCreate}
              disabled={autoCreating}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-left hover:border-violet-300 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-bold text-slate-900">{autoCreating ? "Создаём…" : "Создать все автоматически"}</span>
              <span className="text-[11px] text-slate-500">По одной теме в день с 1 августа 2026</span>
            </button>

            <button
              onClick={() => setOneByOneMode((v) => !v)}
              className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left ${oneByOneMode ? "border-blue-300 bg-blue-50" : "border-blue-100 bg-blue-50/60 hover:border-blue-300"}`}
            >
              <ListPlus className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">{oneByOneMode ? "Скрыть форму" : "Создать по одному"}</span>
              <span className="text-[11px] text-slate-500">Дата и время вручную для каждой темы</span>
            </button>

            <Link
              href={`/teacher/lessons?newLesson=1&groupId=${plan.group_id}&subjectId=${plan.subject_id}`}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-left hover:border-emerald-300"
            >
              <LayoutTemplate className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">Использовать как заготовки</span>
              <span className="text-[11px] text-slate-500">Выбрать тему при обычном создании урока</span>
            </Link>
          </div>

          {autoResult && (
            <div className={`rounded-xl border p-3 text-xs ${autoResult.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {autoResult.error ? (
                <p>{autoResult.error}</p>
              ) : autoResult.created === 0 ? (
                <p>{autoResult.message ?? "Все темы уже созданы как уроки"}</p>
              ) : (
                <>
                  <p className="font-semibold">Создано уроков: {autoResult.created}{autoResult.skipped ? ` (пропущено уже созданных: ${autoResult.skipped})` : ""}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {autoResult.lessons?.map((l) => (
                      <li key={l.topicId}>{l.date} в {l.time} — {l.title}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">Удалить тему?</h3>
            </div>
            <p className="text-sm text-slate-600">
              «{confirmDelete.title}»
              {confirmDelete.used_in_lessons > 0 && ` уже использована в ${confirmDelete.used_in_lessons} уроке(ах) — сами уроки не удалятся, просто отвяжутся от темы.`}
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Удаляем…" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
