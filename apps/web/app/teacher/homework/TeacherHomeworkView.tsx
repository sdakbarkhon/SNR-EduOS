"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDictionary, getSubjectConfig } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { Plus, MoreHorizontal, Trash2, Copy, Pencil, X } from "lucide-react";
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

type TypeFilter = "all" | "file" | "test";
type StatusFilter = "all" | "active" | "pending" | "done" | "overdue";

function statusOf(hw: HomeworkItem): StatusFilter {
  const now = new Date().toISOString();
  const allSubs = [...hw.submissions, ...hw.test_subs.map(t => ({ id: t.id, status: "submitted" }))];
  const pending = hw.submissions.filter(s => s.status === "submitted").length;
  if (pending > 0) return "pending";
  if (!hw.due_date || hw.due_date > now) return "active";
  const allGraded = hw.submissions.every(s => s.status === "graded") && allSubs.length > 0;
  if (allGraded) return "done";
  return "overdue";
}

/** Dropdown menu with delete / duplicate / edit actions. */
function CardMenu({ hw, onDelete, onDuplicate }: {
  hw: HomeworkItem;
  onDelete: () => void;
  onDuplicate: () => void;
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

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setConfirmDelete(true); setOpen(false);
  }
  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setOpen(false); onDuplicate();
  }
  function handleEdit(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setOpen(false); alert("Редактирование — доступно в следующей версии");
  }

  return (
    <>
      <div ref={ref} className="relative shrink-0">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
          className="rounded-lg p-1 text-slate-400 hover:text-brand-ink hover:bg-slate-100">
          <MoreHorizontal size={16} />
        </button>
        {open && (
          <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-[14px] bg-white shadow-xl border border-slate-100">
            <button onClick={handleEdit}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-brand-ink-muted hover:bg-slate-50">
              <Pencil size={14} /> Редактировать
            </button>
            <button onClick={handleDuplicate}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-brand-ink hover:bg-slate-50">
              <Copy size={14} /> Дублировать
            </button>
            <button onClick={handleDelete}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-danger hover:bg-red-50">
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(false)}
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-[16px] font-bold text-brand-ink">Удалить задание?</h3>
              <button onClick={() => setConfirmDelete(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="text-[13px] text-brand-ink-muted mb-4">
              «{hw.title}» и все сдачи будут удалены безвозвратно.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-[12px] border border-slate-200 py-2.5 text-[14px] font-semibold text-brand-ink hover:bg-slate-50">
                Отмена
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); onDelete(); }}
                className="flex-1 rounded-[12px] bg-red-500 py-2.5 text-[14px] font-bold text-white hover:bg-red-600">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function TeacherHomeworkView({ homework, groups }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();
  const supabase = createClient();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [localHW, setLocalHW] = useState<HomeworkItem[]>(homework);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = localHW.filter(hw => {
    if (typeFilter !== "all" && hw.content_type !== typeFilter) return false;
    if (groupFilter !== "all" && hw.group.id !== groupFilter) return false;
    if (statusFilter !== "all" && statusOf(hw) !== statusFilter) return false;
    return true;
  });

  const counts = {
    active:  localHW.filter(h => statusOf(h) === "active").length,
    pending: localHW.filter(h => statusOf(h) === "pending").length,
    done:    localHW.filter(h => statusOf(h) === "done").length,
    overdue: localHW.filter(h => statusOf(h) === "overdue").length,
  };

  async function deleteHW(hw: HomeworkItem) {
    setBusyId(hw.id);
    const { error } = await supabase.from("homework").delete().eq("id", hw.id);
    setBusyId(null);
    if (error) { alert(error.message); return; }
    setLocalHW(list => list.filter(h => h.id !== hw.id));
  }

  async function duplicateHW(hw: HomeworkItem) {
    setBusyId(hw.id);
    try {
      // Copy homework record
      const { data: newHW, error: hwErr } = await supabase
        .from("homework")
        .insert({
          group_id: hw.group.id,
          title: hw.title + " (копия)",
          description: null,
          due_date: hw.due_date,
          content_type: hw.content_type,
          source: "teacher",
          teacher_id: hw.teacher_id,
        })
        .select("id")
        .single();
      if (hwErr || !newHW) throw hwErr ?? new Error("no data");
      const newId = (newHW as { id: string }).id;

      // If test — copy questions and options
      if (hw.content_type === "test") {
        const { data: questions } = await supabase
          .from("test_questions")
          .select("*, options:test_question_options(*)")
          .eq("homework_id", hw.id);
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
              q.options.map(o => ({
                question_id: (newQ as { id: string }).id,
                option_text: o.option_text, is_correct: o.is_correct, order_index: o.order_index,
              }))
            );
          }
        }
      }

      // Optimistic insert into local state (empty submissions/test_subs)
      setLocalHW(list => [{
        ...hw,
        id: newId,
        title: hw.title + " (копия)",
        submissions: [],
        test_subs: [],
      }, ...list]);
      router.refresh();
    } catch (e: unknown) {
      alert((e as Error).message ?? "Ошибка при дублировании");
    } finally {
      setBusyId(null);
    }
  }

  const typeButtons: { key: TypeFilter; label: string }[] = [
    { key: "all",  label: d.teacher.filterAll },
    { key: "file", label: d.teacher.filterFiles },
    { key: "test", label: d.teacher.filterTests },
  ];

  const statusButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all",     label: d.teacher.filterAll,    count: localHW.length },
    { key: "active",  label: d.teacher.statsActive,  count: counts.active },
    { key: "pending", label: d.teacher.statsPending, count: counts.pending },
    { key: "done",    label: d.teacher.statsDone,    count: counts.done },
    { key: "overdue", label: d.teacher.statsOverdue, count: counts.overdue },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-brand-ink">{d.teacher.homeworkTitle}</h1>
        <Link href="/teacher/homework/new"
          className="flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)", boxShadow: "0 4px 16px rgba(29,111,245,0.4)" }}>
          <Plus size={16} />
          {d.teacher.createBtn.replace("+ ", "")}
        </Link>
      </div>

      {/* Type pills + group filter */}
      <div className="flex items-center gap-2">
        {typeButtons.map(b => (
          <button key={b.key} onClick={() => setTypeFilter(b.key)}
            className={cn("rounded-[10px] px-4 py-1.5 text-[13px] font-semibold transition-all",
              typeFilter === b.key
                ? "bg-brand-blue text-white shadow"
                : "bg-white/70 border border-white/80 text-brand-ink-muted hover:text-brand-ink")}>
            {b.label}
          </button>
        ))}
        <div className="ml-auto">
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            className="rounded-[10px] border border-white/80 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-brand-ink focus:outline-none">
            <option value="all">{d.teacher.allGroups}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Homework cards */}
        <div className="space-y-3 lg:col-span-2">
          {filtered.length === 0 && (
            <div className="rounded-[20px] bg-white/70 border border-white/80 p-8 text-center text-brand-ink-muted">
              {d.homework.noTasks}
            </div>
          )}
          {filtered.map(hw => {
            const cfg = getSubjectConfig(hw.group.subject);
            // Enrolled students in this group (real count from DB)
            const totalStudents = hw.group.enrolled?.length ?? 0;
            // Count any submission (file OR test) as "сдал"
            const submittedCount = hw.submissions.length + hw.test_subs.length;
            const pendingCount = hw.submissions.filter(s => s.status === "submitted").length;
            const pct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
            const now = new Date().toISOString();
            const overdue = hw.due_date && hw.due_date < now;
            const busy = busyId === hw.id;

            return (
              <Link key={hw.id} href={`/teacher/homework/${hw.id}`}
                className={cn(
                  "flex items-start gap-4 rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-4 transition-all hover:bg-white/90",
                  busy && "opacity-50 pointer-events-none"
                )}
                style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-[22px]"
                  style={{ background: cfg.color + "20" }}>
                  {cfg.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-brand-ink leading-snug">{hw.title}</h3>
                    <CardMenu hw={hw} onDelete={() => deleteHW(hw)} onDuplicate={() => duplicateHW(hw)} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {hw.group.name}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                      hw.content_type === "test" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>
                      {hw.content_type === "test" ? d.homework.typeTest : d.homework.typeFile}
                    </span>
                    {pendingCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {pendingCount} {d.teacher.statsPending}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[11px] text-brand-ink-muted">
                      <span>{submittedCount} / {totalStudents} {d.teacher.progressLabel}</span>
                      {hw.due_date && (
                        <span className={overdue ? "text-danger" : "text-brand-ink-muted"}>
                          {new Date(hw.due_date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Stats panel */}
        <div className="space-y-4">
          <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <h3 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.statsTitle}</h3>
            <div className="space-y-2">
              {statusButtons.map(b => (
                <button key={b.key} onClick={() => setStatusFilter(b.key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium transition-all",
                    statusFilter === b.key
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-brand-ink-muted hover:bg-slate-50 hover:text-brand-ink")}>
                  <span>{b.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold",
                    statusFilter === b.key ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600")}>
                    {b.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
