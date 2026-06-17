"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDictionary, getSubjectConfig, deleteHomework } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { Plus, Filter, MoreHorizontal, Trash2, Copy, Pencil, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Submission = { id: string; status: string };
type TestSub = { id: string; student_id: string };
type HomeworkItem = {
  id: string; title: string; due_date: string | null; content_type: "file" | "test";
  teacher_id: string | null;
  group: {
    id: string; name: string; subject: string;
    enrolled: Array<{ student_id: string }>;
  };
  submissions: Submission[];
  test_subs: TestSub[];
};

interface Props {
  homework: HomeworkItem[];
  groups: Array<{ id: string; name: string; subject: string }>;
}

type StatusFilter = "all" | "active" | "done";

function isActive(hw: HomeworkItem): boolean {
  const now = new Date().toISOString();
  const hasPending = hw.submissions.some((s) => s.status === "submitted");
  return !hw.due_date || hw.due_date > now || hasPending;
}

/** Dropdown menu: edit (stub) / duplicate / delete (confirm). */
function CardMenu({ hw, onDelete, onDuplicate }: {
  hw: HomeworkItem; onDelete: () => void; onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function stop(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); }

  return (
    <>
      <div ref={ref} className="relative shrink-0">
        <button onClick={(e) => { stop(e); setOpen((v) => !v); }}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-slate-100 hover:text-gray-600">
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {open && (
          <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-[14px] border border-slate-100 bg-white shadow-xl">
            <button onClick={(e) => { stop(e); setOpen(false); alert("Редактирование — доступно в следующей версии"); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-brand-ink-muted hover:bg-slate-50">
              <Pencil size={14} /> Редактировать
            </button>
            <button onClick={(e) => { stop(e); setOpen(false); onDuplicate(); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-brand-ink hover:bg-slate-50">
              <Copy size={14} /> Дублировать
            </button>
            <button onClick={(e) => { stop(e); setConfirmDelete(true); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-danger hover:bg-red-50">
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(false)}
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-[16px] font-bold text-brand-ink">Удалить задание?</h3>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg p-1 text-gray-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="mb-4 text-[13px] text-brand-ink-muted">«{hw.title}» и все сдачи будут удалены безвозвратно.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-[12px] border border-slate-200 py-2.5 text-[14px] font-semibold text-brand-ink hover:bg-slate-50">Отмена</button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); onDelete(); }}
                className="flex-1 rounded-[12px] bg-red-500 py-2.5 text-[14px] font-bold text-white hover:bg-red-600">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Tri-color check-stats donut via conic-gradient. */
function ChecksDonut({ checked, pending, overdue }: { checked: number; pending: number; overdue: number }) {
  const total = checked + pending + overdue;
  const t = total || 1;
  const p1 = (checked / t) * 100;
  const p2 = p1 + (pending / t) * 100;
  const bg = total === 0
    ? "#e5e7eb"
    : `conic-gradient(#10b981 0 ${p1}%, #f59e0b ${p1}% ${p2}%, #ef4444 ${p2}% 100%)`;
  return (
    <div className="relative h-48 w-48">
      <div className="h-full w-full rounded-full" style={{ background: bg }} />
      <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white">
        <span className="text-3xl font-bold text-gray-900">{total}</span>
        <span className="text-xs font-semibold text-gray-500">Всего работ</span>
      </div>
    </div>
  );
}

export function TeacherHomeworkView({ homework, groups }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();
  const supabase = createClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [localHW, setLocalHW] = useState<HomeworkItem[]>(homework);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = localHW.filter((hw) => {
    if (groupFilter !== "all" && hw.group.id !== groupFilter) return false;
    if (statusFilter === "active" && !isActive(hw)) return false;
    if (statusFilter === "done" && isActive(hw)) return false;
    return true;
  });

  // Tri-color donut over all works (file submissions + test attempts)
  const now = new Date().toISOString();
  let checked = 0, pending = 0, overdue = 0;
  localHW.forEach((hw) => {
    const isOverdue = !!hw.due_date && hw.due_date < now;
    hw.submissions.forEach((s) => {
      if (s.status === "graded") checked++;
      else if (isOverdue) overdue++;
      else pending++;
    });
    // test attempts awaiting review
    hw.test_subs.forEach(() => { if (isOverdue) overdue++; else pending++; });
  });

  async function deleteHW(hw: HomeworkItem) {
    setBusyId(hw.id);
    try {
      await deleteHomework(supabase, hw.id);
      setLocalHW((list) => list.filter((h) => h.id !== hw.id));
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateHW(hw: HomeworkItem) {
    setBusyId(hw.id);
    try {
      const { data: newHW, error: hwErr } = await supabase
        .from("homework")
        .insert({
          group_id: hw.group.id, title: hw.title + " (копия)", description: null,
          due_date: hw.due_date, content_type: hw.content_type, source: "teacher", teacher_id: hw.teacher_id,
        })
        .select("id").single();
      if (hwErr || !newHW) throw hwErr ?? new Error("no data");
      const newId = (newHW as { id: string }).id;

      if (hw.content_type === "test") {
        const { data: questions } = await supabase
          .from("test_questions").select("*, options:test_question_options(*)").eq("homework_id", hw.id);
        for (const q of (questions ?? []) as Array<{
          question_text: string; question_type: string; order_index: number;
          options: Array<{ option_text: string; is_correct: boolean; order_index: number }>;
        }>) {
          const { data: newQ } = await supabase
            .from("test_questions")
            .insert({ homework_id: newId, question_text: q.question_text, question_type: q.question_type, order_index: q.order_index })
            .select("id").single();
          if (newQ && q.options?.length) {
            await supabase.from("test_question_options").insert(
              q.options.map((o) => ({
                question_id: (newQ as { id: string }).id,
                option_text: o.option_text, is_correct: o.is_correct, order_index: o.order_index,
              })),
            );
          }
        }
      }

      setLocalHW((list) => [{ ...hw, id: newId, title: hw.title + " (копия)", submissions: [], test_subs: [] }, ...list]);
      router.refresh();
    } catch (e: unknown) {
      alert((e as Error).message ?? "Ошибка при дублировании");
    } finally {
      setBusyId(null);
    }
  }

  const statusPills: { key: StatusFilter; label: string }[] = [
    { key: "all", label: d.teacher.filterAll },
    { key: "active", label: d.teacher.statsActive },
    { key: "done", label: d.teacher.statsDone },
  ];

  const legend = [
    { label: d.teacher.statsDone, value: checked, color: "#10b981" },
    { label: d.teacher.statsPending, value: pending, color: "#f59e0b" },
    { label: d.teacher.statsOverdue, value: overdue, color: "#ef4444" },
  ];

  return (
    <div className="flex max-w-7xl flex-col gap-8 lg:flex-row">
      {/* Main */}
      <div className="flex-1">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">{d.teacher.homeworkTitle}</h1>
          <Link href="/teacher/homework/new"
            className="flex items-center rounded-[12px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700">
            <Plus className="mr-2 h-5 w-5" />
            {d.teacher.createBtn.replace("+ ", "")}
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-full border border-white/50 bg-white/60 py-2 pl-9 pr-4 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur outline-none">
              <option value="all">{d.teacher.allGroups}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {statusPills.map((p) => (
            <button key={p.key} onClick={() => setStatusFilter(p.key)}
              className={cn("rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                statusFilter === p.key
                  ? "bg-gray-900 text-white"
                  : "border border-white/50 bg-white/60 text-gray-600 backdrop-blur hover:text-gray-900")}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-[24px] border border-white/50 bg-white/70 p-8 text-center text-brand-ink-muted">
            {d.homework.noTasks}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filtered.map((hw) => {
              const cfg = getSubjectConfig(hw.group.subject);
              const total = hw.group.enrolled?.length ?? 0;
              const submitted = hw.submissions.length + hw.test_subs.length;
              const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
              const active = isActive(hw);
              const busy = busyId === hw.id;

              return (
                <Link key={hw.id} href={`/teacher/homework/${hw.id}`}
                  className={cn(
                    "rounded-[24px] border border-white/50 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-colors hover:bg-white/90",
                    busy && "pointer-events-none opacity-50",
                  )}>
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-[22px]"
                        style={{ background: cfg.color + "20" }}>
                        {cfg.emoji}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold leading-tight text-gray-900">{hw.title}</h3>
                        <p className="text-sm font-medium text-gray-500">{cfg.label}</p>
                      </div>
                    </div>
                    <CardMenu hw={hw} onDelete={() => deleteHW(hw)} onDuplicate={() => duplicateHW(hw)} />
                  </div>

                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="rounded-[8px] border border-blue-200/50 bg-blue-100/80 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{hw.group.name}</span>
                    <span className={cn("rounded-[8px] border px-2.5 py-1 text-[11px] font-semibold",
                      hw.content_type === "test"
                        ? "border-amber-200/50 bg-amber-100/80 text-amber-700"
                        : "border-gray-200/50 bg-gray-100/80 text-gray-700")}>
                      {hw.content_type === "test" ? d.homework.typeTest : d.homework.typeFile}
                    </span>
                    {active && (
                      <span className="rounded-[8px] border border-emerald-200/50 bg-emerald-100/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{d.teacher.statsActive}</span>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex justify-between text-sm font-semibold">
                      <span className="text-gray-500">{d.teacher.detailSubmitted}</span>
                      <span className="text-gray-900">{submitted} / {total}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: checks stats donut */}
      <div className="w-full lg:w-80">
        <div className="flex flex-col items-center rounded-[24px] border border-white/50 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <h3 className="mb-6 self-start font-bold text-gray-900">Статистика проверок</h3>
          <ChecksDonut checked={checked} pending={pending} overdue={overdue} />
          <div className="mt-6 w-full space-y-3">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: l.color }} />
                  <span className="text-sm font-medium text-gray-600">{l.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{l.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
