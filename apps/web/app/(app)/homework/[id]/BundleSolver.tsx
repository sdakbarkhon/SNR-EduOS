"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Blocks, ChevronDown, ChevronUp, ClipboardList, Code2, FileText, Loader2, Send,
} from "lucide-react";
import {
  getDictionary,
  getSubjectStyle,
  getOrCreateBundleSubmission,
  getHomeworkSubtaskSubmissions,
  saveHomeworkSubtaskProgress,
  submitHomeworkBundle,
  type HomeworkWithSubmission,
  type HomeworkSubmission,
  type HomeworkSubtask,
  type HomeworkSubtaskSubmission,
  type HomeworkSubtaskType,
  type Locale,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, Modal, SubjectIcon, useLocale } from "@/components";
import { CodeEditor, CodeViewer } from "@/components/CodeEditor";
import { toScratchIframeSrc } from "@/lib/external-services";
import { cn } from "@/lib/cn";

// Same fallback used by lesson stages when the teacher didn't attach a
// specific Scratch project URL (see ExternalStageModal.tsx).
const DEFAULT_SCRATCH_EMBED = "https://scratch.mit.edu/projects/1351866425/embed";

type TestQuestionConfig = { question: string; options: string[]; correctIndex: number };
type Dict = ReturnType<typeof getDictionary>;

function subtaskTypeLabel(type: HomeworkSubtaskType, d: Dict): string {
  switch (type) {
    case "file": return d.homework.typeFile;
    case "test": return d.homework.typeTest;
    case "code": return d.homework.typeProgrammingShort;
    case "scratch": return d.homework.typeScratch;
  }
}

function subtaskTypeIcon(type: HomeworkSubtaskType) {
  switch (type) {
    case "file": return FileText;
    case "test": return ClipboardList;
    case "code": return Code2;
    case "scratch": return Blocks;
  }
}

/** not-started = no row yet / empty content; in-progress = some content but not completed; done = completed. */
function subtaskStatus(sub: HomeworkSubtaskSubmission | undefined): "done" | "in_progress" | "not_started" {
  if (!sub) return "not_started";
  if (sub.completed) return "done";
  const content = sub.content ?? {};
  const hasContent = Object.values(content).some((v) => {
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return v;
    return v != null;
  });
  return hasContent ? "in_progress" : "not_started";
}

function StatusBadge({ status, bd }: { status: "done" | "in_progress" | "not_started"; bd: Dict["homework"]["bundle"] }) {
  const cfg = {
    done: { label: bd.subtaskDone, cls: "bg-emerald-100 text-emerald-700" },
    in_progress: { label: bd.subtaskInProgress, cls: "bg-amber-100 text-amber-700" },
    not_started: { label: bd.subtaskNotStarted, cls: "bg-slate-100 text-slate-500" },
  }[status];
  return (
    <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

/** Debounces saves per-subtask so fast typing doesn't spam the DB. */
function useDebouncedSave() {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);
  return useCallback((key: string, fn: () => void, delay = 800) => {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.set(key, setTimeout(fn, delay));
  }, []);
}

function FileSubtaskEditor({
  content, onSave, readOnly, placeholder,
}: {
  content: Record<string, unknown> | undefined;
  onSave: (content: Record<string, unknown>, completed: boolean, immediate?: boolean) => void;
  readOnly: boolean;
  placeholder: string;
}) {
  const text = (content?.text as string) ?? "";
  return (
    <textarea
      value={text}
      readOnly={readOnly}
      onChange={(e) => onSave({ text: e.target.value }, e.target.value.trim().length > 0)}
      placeholder={placeholder}
      rows={5}
      className={cn(
        "w-full resize-none rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none",
        readOnly && "bg-slate-50 text-slate-600",
      )}
    />
  );
}

function TestSubtaskEditor({
  subtask, content, onSave, readOnly, placeholder,
}: {
  subtask: HomeworkSubtask;
  content: Record<string, unknown> | undefined;
  onSave: (content: Record<string, unknown>, completed: boolean, immediate?: boolean) => void;
  readOnly: boolean;
  placeholder: string;
}) {
  const config = (subtask.config ?? {}) as { questions?: TestQuestionConfig[] };
  const questions = config.questions ?? [];

  if (questions.length > 0) {
    const answers = (content?.answers as Array<{ questionIndex: number; selectedIndex: number }>) ?? [];
    const selectedMap = new Map(answers.map((a) => [a.questionIndex, a.selectedIndex]));

    function choose(qIdx: number, optIdx: number) {
      if (readOnly) return;
      const next = new Map(selectedMap);
      next.set(qIdx, optIdx);
      const nextAnswers = Array.from(next.entries()).map(([questionIndex, selectedIndex]) => ({ questionIndex, selectedIndex }));
      const completed = questions.every((_, i) => next.has(i));
      onSave({ answers: nextAnswers }, completed, true);
    }

    return (
      <div className="flex flex-col gap-4">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="mb-2 text-sm font-semibold text-brand-ink">
              {qi + 1}. {q.question}
            </p>
            <div className="flex flex-col gap-1.5">
              {q.options.map((opt, oi) => {
                const selected = selectedMap.get(qi) === oi;
                return (
                  <label
                    key={oi}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all",
                      selected ? "border-brand-blue bg-blue-50 font-semibold text-brand-blue" : "border-slate-200 bg-white/80 text-brand-ink-muted",
                      readOnly ? "cursor-default" : "cursor-pointer hover:border-brand-blue/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`bundle-q-${subtask.id}-${qi}`}
                      className="sr-only"
                      checked={selected}
                      disabled={readOnly}
                      onChange={() => choose(qi, oi)}
                    />
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-brand-blue" : "border-slate-300")}>
                      {selected && <span className="h-2 w-2 rounded-full bg-brand-blue" />}
                    </span>
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Manually-created test subtask (no questions) — freeform answer.
  return <FileSubtaskEditor content={content} onSave={onSave} readOnly={readOnly} placeholder={placeholder} />;
}

function CodeSubtaskEditor({
  subtask, content, onSave, readOnly,
}: {
  subtask: HomeworkSubtask;
  content: Record<string, unknown> | undefined;
  onSave: (content: Record<string, unknown>, completed: boolean, immediate?: boolean) => void;
  readOnly: boolean;
}) {
  const config = (subtask.config ?? {}) as { starterCode?: string; language?: "python" | "cpp" };
  const lang = config.language ?? "python";
  const code = (content?.code as string) ?? config.starterCode ?? "";

  if (readOnly) {
    return <CodeViewer value={code} language={lang} minHeight={220} />;
  }
  return (
    <CodeEditor
      value={code}
      language={lang}
      minHeight={220}
      onChange={(v) => onSave({ code: v }, v.trim().length > 0)}
    />
  );
}

function ScratchSubtaskEditor({
  subtask, content, onSave, readOnly,
}: {
  subtask: HomeworkSubtask;
  content: Record<string, unknown> | undefined;
  onSave: (content: Record<string, unknown>, completed: boolean, immediate?: boolean) => void;
  readOnly: boolean;
}) {
  const config = (subtask.config ?? {}) as { url?: string };
  const src = config.url ? (toScratchIframeSrc(config.url) ?? DEFAULT_SCRATCH_EMBED) : DEFAULT_SCRATCH_EMBED;
  const acknowledged = (content?.acknowledged as boolean) ?? false;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-slate-200" style={{ aspectRatio: "16 / 9" }}>
        <iframe src={src} className="h-full w-full" allow="autoplay" title={subtask.title} />
      </div>
      <label className={cn("flex items-center gap-2 text-sm text-brand-ink", readOnly ? "opacity-70" : "cursor-pointer")}>
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={readOnly}
          onChange={(e) => onSave({ acknowledged: e.target.checked }, e.target.checked, true)}
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
        />
        Отметить как выполнено
      </label>
    </div>
  );
}

function SubtaskRow({
  subtask, index, sub, expanded, onToggle, readOnly, onSave, d,
}: {
  subtask: HomeworkSubtask;
  index: number;
  sub: HomeworkSubtaskSubmission | undefined;
  expanded: boolean;
  onToggle: () => void;
  readOnly: boolean;
  onSave: (content: Record<string, unknown>, completed: boolean, immediate?: boolean) => void;
  d: Dict;
}) {
  const Icon = subtaskTypeIcon(subtask.type);
  const status = subtaskStatus(sub);
  const bd = d.homework.bundle;

  return (
    <div
      className="overflow-hidden rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl"
      style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[13px] font-bold text-brand-blue">
          {index + 1}
        </span>
        <Icon size={16} className="shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-ink">{subtask.title}</p>
          <p className="text-[11px] text-brand-ink-muted">{subtaskTypeLabel(subtask.type, d)}</p>
        </div>
        <StatusBadge status={status} bd={bd} />
        {expanded ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-white/60 p-4">
          {subtask.description && (
            <p className="mb-3 whitespace-pre-wrap text-sm text-brand-ink-muted">{subtask.description}</p>
          )}
          {subtask.type === "file" && (
            <FileSubtaskEditor content={sub?.content} onSave={onSave} readOnly={readOnly} placeholder={d.homework.answerPlaceholder} />
          )}
          {subtask.type === "test" && (
            <TestSubtaskEditor subtask={subtask} content={sub?.content} onSave={onSave} readOnly={readOnly} placeholder={d.homework.answerPlaceholder} />
          )}
          {subtask.type === "code" && (
            <CodeSubtaskEditor subtask={subtask} content={sub?.content} onSave={onSave} readOnly={readOnly} />
          )}
          {subtask.type === "scratch" && (
            <ScratchSubtaskEditor subtask={subtask} content={sub?.content} onSave={onSave} readOnly={readOnly} />
          )}
        </div>
      )}
    </div>
  );
}

export function BundleSolver({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const bd = d.homework.bundle;
  const style = getSubjectStyle(hw.group.subject);
  const subtasks = hw.subtasks ?? [];

  const [studentId, setStudentId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(hw.submission ?? null);
  const [subtaskSubs, setSubtaskSubs] = useState<Map<string, HomeworkSubtaskSubmission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const debouncedSave = useDebouncedSave();

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const { data: studentRow } = await sb.from("students").select("id").single();
        if (!studentRow || cancelled) return;
        const sid = (studentRow as { id: string }).id;
        setStudentId(sid);

        const sub = await getOrCreateBundleSubmission(sb, { homeworkId: hw.id, studentId: sid });
        if (cancelled) return;
        setSubmission(sub);

        const subs = await getHomeworkSubtaskSubmissions(sb, sub.id);
        if (cancelled) return;
        const map = new Map<string, HomeworkSubtaskSubmission>();
        subs.forEach((s) => map.set(s.subtask_id, s));
        setSubtaskSubs(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hw.id]);

  const alreadySubmitted = submission != null && submission.status !== "in_progress";

  function persistLocal(subtaskId: string, content: Record<string, unknown>, completed: boolean) {
    setSubtaskSubs((prev) => {
      const next = new Map(prev);
      const existing = next.get(subtaskId);
      next.set(subtaskId, {
        id: existing?.id ?? subtaskId,
        submission_id: submission?.id ?? "",
        subtask_id: subtaskId,
        content,
        completed,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return next;
    });
  }

  async function persistRemote(subtaskId: string, content: Record<string, unknown>, completed: boolean) {
    if (!submission) return;
    try {
      const row = await saveHomeworkSubtaskProgress(sb, { submissionId: submission.id, subtaskId, content, completed });
      setSubtaskSubs((prev) => new Map(prev).set(subtaskId, row));
    } catch {
      // Best-effort autosave — local optimistic state already reflects the edit.
    }
  }

  function makeSaveHandler(subtaskId: string) {
    return (content: Record<string, unknown>, completed: boolean, immediate = false) => {
      persistLocal(subtaskId, content, completed);
      if (immediate) {
        persistRemote(subtaskId, content, completed);
      } else {
        debouncedSave(subtaskId, () => persistRemote(subtaskId, content, completed));
      }
    };
  }

  const doneCount = subtasks.filter((s) => subtaskSubs.get(s.id)?.completed).length;
  const totalCount = subtasks.length;

  async function doSubmit() {
    if (!submission || submitting) return;
    setSubmitting(true);
    try {
      await submitHomeworkBundle(sb, submission.id);
      setConfirmOpen(false);
      router.push("/homework");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitAllClick() {
    if (doneCount < totalCount) {
      setConfirmOpen(true);
    } else {
      doSubmit();
    }
  }

  const dueLabel = hw.due_date
    ? new Date(hw.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        {d.common.back}
      </button>

      {/* Header */}
      <GlassCard className="mb-4 p-5">
        <div className="flex items-start gap-4">
          <SubjectIcon subject={hw.group.subject} size={48} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: style.color }}>
                {style.label} · {hw.group.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                <Blocks size={11} /> {d.homework.typeBundle}
              </span>
            </div>
            <h1 className="mb-2 text-xl font-bold text-slate-800">{hw.title}</h1>
            {dueLabel && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium">{d.homework.detailDeadline}:</span>
                {dueLabel}
              </div>
            )}
          </div>
        </div>
        {hw.description && (
          <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
            {hw.description}
          </p>
        )}
        {alreadySubmitted && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {bd.submittedStatus}
            </span>
          </div>
        )}
      </GlassCard>

      {loading ? (
        <GlassCard className="flex items-center justify-center gap-2 p-8 text-slate-400">
          <Loader2 size={18} className="animate-spin" />
          {d.common.loading}
        </GlassCard>
      ) : (
        <>
          {/* Subtasks */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{bd.subtasksTitle}</p>
          <div className="flex flex-col gap-3">
            {subtasks.map((s, i) => (
              <SubtaskRow
                key={s.id}
                subtask={s}
                index={i}
                sub={subtaskSubs.get(s.id)}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId((cur) => (cur === s.id ? null : s.id))}
                readOnly={alreadySubmitted}
                onSave={makeSaveHandler(s.id)}
                d={d}
              />
            ))}
          </div>

          {alreadySubmitted ? (
            submission?.grade != null || submission?.teacher_comment ? (
              <GlassCard className="mt-4 p-5">
                {submission?.grade != null && (
                  <span className="text-sm font-semibold text-slate-700">
                    {d.homework.grade}: {submission.grade}
                  </span>
                )}
                {submission?.teacher_comment && (
                  <div className="mt-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                    <span className="font-medium">{d.homework.teacherComment}: </span>
                    {submission.teacher_comment}
                  </div>
                )}
              </GlassCard>
            ) : null
          ) : (
            <div className="sticky bottom-4 mt-5">
              <div
                className="flex items-center justify-between gap-3 rounded-[18px] border border-white/80 bg-white/85 p-4 backdrop-blur-xl"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
              >
                <span className="text-sm font-medium text-brand-ink-muted">
                  {bd.progressLabel.replace("{done}", String(doneCount)).replace("{total}", String(totalCount))}
                </span>
                <button
                  type="button"
                  onClick={handleSubmitAllClick}
                  disabled={submitting || !submission || totalCount === 0}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#1D6FF5 0%,#0B3EDB 100%)" }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {bd.submitAll}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={bd.confirmPartialTitle}>
        <p className="mb-5 text-sm text-slate-600">
          {bd.confirmPartialBody.replace("{done}", String(doneCount)).replace("{total}", String(totalCount))}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {bd.confirmBackBtn}
          </button>
          <button
            type="button"
            onClick={doSubmit}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#1D6FF5 0%,#0B3EDB 100%)" }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {bd.confirmSubmitBtn}
          </button>
        </div>
      </Modal>
    </div>
  );
}
