"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getDictionary,
  getHomeworkSubtasks,
  getHomeworkSubtaskSubmissions,
  gradeSubmission,
} from "@snr/core";
import type { Locale, HomeworkSubtask, HomeworkSubtaskSubmission, HomeworkSubtaskType, CodeLanguage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { CodeViewer } from "@/components/CodeEditor";
import { cn } from "@/lib/cn";
import { X, Check } from "lucide-react";
import { SERVICE_CONFIG, isExternalService } from "@/lib/external-services";
import { isDemoEditBlockedError } from "@/lib/useIsDemoSession";

type BundleSub = {
  id: string;
  status: string;
  grade: number | null;
  teacher_comment: string | null;
  submitted_at: string | null;
  student: { id: string; full_name: string; avatar_url: string | null };
};

type HW = {
  id: string;
  content_type: string;
  group: { id: string; name: string; subject: string };
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/20 text-[13px] font-bold text-brand-blue">
      {initials(name)}
    </div>
  );
}

/** Ответ ученика по одной подзадаче — рендер зависит от типа подзадачи. */
function SubtaskAnswer({
  subtask,
  answer,
}: {
  subtask: HomeworkSubtask;
  answer: HomeworkSubtaskSubmission | undefined;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  if (!answer) {
    return <p className="text-[13px] italic text-brand-ink-muted">{d.homework.bundle.subtaskNotStarted}</p>;
  }

  if (subtask.type === "file") {
    const text = (answer.content as { text?: string }).text ?? "";
    return text ? (
      <div className="whitespace-pre-wrap rounded-[10px] bg-slate-50 p-3 text-[13px] text-brand-ink">{text}</div>
    ) : (
      <p className="text-[13px] italic text-brand-ink-muted">Нет ответа</p>
    );
  }

  if (subtask.type === "test") {
    const questions = (subtask.config as {
      questions?: Array<{ question: string; options: string[]; correctIndex: number }>;
    }).questions;
    if (questions && questions.length > 0) {
      const answers = (answer.content as {
        answers?: Array<{ questionIndex: number; selectedIndex: number }>;
      }).answers ?? [];
      return (
        <div className="space-y-2">
          {questions.map((q, qi) => {
            const picked = answers.find((a) => a.questionIndex === qi)?.selectedIndex;
            return (
              <div key={qi} className="space-y-1 rounded-[10px] bg-slate-50 p-2.5">
                <div className="text-[12px] font-semibold text-brand-ink">{qi + 1}. {q.question}</div>
                <div className="space-y-1">
                  {q.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={cn(
                        "rounded-[8px] px-2 py-1 text-[12px]",
                        picked === oi ? "bg-brand-blue/10 font-semibold text-brand-blue" : "text-brand-ink-muted",
                      )}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
                {picked == null && <p className="text-[11px] italic text-brand-ink-muted">Нет ответа</p>}
              </div>
            );
          })}
        </div>
      );
    }
    const text = (answer.content as { text?: string }).text ?? "";
    return text ? (
      <div className="whitespace-pre-wrap rounded-[10px] bg-slate-50 p-3 text-[13px] text-brand-ink">{text}</div>
    ) : (
      <p className="text-[13px] italic text-brand-ink-muted">Нет ответа</p>
    );
  }

  if (subtask.type === "code") {
    const code = (answer.content as { code?: string }).code ?? "";
    const language = (subtask.config as { language?: CodeLanguage }).language ?? "python";
    return code ? (
      <CodeViewer value={code} language={language} minHeight={140} />
    ) : (
      <p className="text-[13px] italic text-brand-ink-muted">Нет кода</p>
    );
  }

  // external service subtask (wokwi/codesandbox/geogebra/.../h5p)
  const ack = (answer.content as { acknowledged?: boolean }).acknowledged === true;
  return (
    <p className={cn("flex items-center gap-1 text-[13px] font-medium", ack ? "text-emerald-600" : "text-brand-ink-muted")}>
      {ack ? <><Check className="h-3.5 w-3.5" /> Отметил как выполнено</> : "— Не отмечено"}
    </p>
  );
}

function subtaskTypeLabel(d: ReturnType<typeof getDictionary>, type: HomeworkSubtaskType) {
  if (isExternalService(type)) return SERVICE_CONFIG[type].name;
  switch (type) {
    case "file": return d.homework.typeFile;
    case "test": return d.homework.typeTest;
    case "code": return d.homework.typeProgrammingShort;
    default: return type;
  }
}

/** Модалка проверки bundle-сдачи: ответы по всем подзадачам + одна оценка/комментарий на весь набор. */
function BundleGradeModal({
  submission,
  subtasks,
  answers,
  onClose,
  onGraded,
}: {
  submission: BundleSub;
  subtasks: HomeworkSubtask[];
  answers: HomeworkSubtaskSubmission[];
  onClose: () => void;
  onGraded: (grade: number, comment: string) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();
  const [grade, setGrade] = useState(submission.grade != null ? String(submission.grade) : "");
  const [comment, setComment] = useState(submission.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function answerFor(subtaskId: string) {
    return answers.find((a) => a.subtask_id === subtaskId);
  }

  async function submit() {
    const gradeNum = Number(grade.trim());
    if (!grade.trim() || isNaN(gradeNum) || gradeNum < 2 || gradeNum > 5) {
      setError("Введите оценку от 2 до 5");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gradeSubmission(supabase, { submissionId: submission.id, grade: gradeNum, comment: comment.trim() });
      onGraded(gradeNum, comment.trim());
    } catch (e: unknown) {
      setError(isDemoEditBlockedError(e) ? d.demoMode.cannotEditRealData : (e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-brand-ink">{d.teacher.reviewTitle}</h2>
            <p className="mt-0.5 text-[12px] text-brand-ink-muted">{submission.student.full_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-brand-ink-muted">{d.teacher.bundleStudentAnswers}</h3>
            <div className="space-y-3">
              {subtasks.map((st) => (
                <div key={st.id} className="rounded-[14px] bg-slate-50/70 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-ink-muted">
                      {subtaskTypeLabel(d, st.type)}
                    </span>
                    <span className="text-[13px] font-semibold text-brand-ink">{st.title}</span>
                  </div>
                  <SubtaskAnswer subtask={st} answer={answerFor(st.id)} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.bundleGradeLabel}</span>
              <input
                type="number"
                min={2}
                max={5}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-24 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[14px] font-bold text-brand-ink focus:outline-none focus:border-brand-blue/50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.bundleCommentLabel}</span>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-brand-ink focus:outline-none focus:border-brand-blue/50"
              />
            </label>
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-[12px] py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}
          >
            {saving ? d.common.loading : d.teacher.reviewSend}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TeacherBundleSubmissions({ hw, submissions }: { hw: HW; submissions: BundleSub[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();

  // 'in_progress' bundle submissions are the student's unfinished draft — not
  // really "submitted" yet, same treatment as elsewhere in the app.
  const [subs, setSubs] = useState<BundleSub[]>(submissions.filter((s) => s.status !== "in_progress"));
  const [subtasks, setSubtasks] = useState<HomeworkSubtask[]>([]);
  const [answersBySub, setAnswersBySub] = useState<Record<string, HomeworkSubtaskSubmission[]>>({});
  const [openSub, setOpenSub] = useState<BundleSub | null>(null);

  useEffect(() => {
    setSubs(submissions.filter((s) => s.status !== "in_progress"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions]);

  useEffect(() => {
    let alive = true;
    getHomeworkSubtasks(supabase, hw.id).then((rows) => {
      if (alive) setSubtasks(rows);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hw.id]);

  const subIdsKey = subs.map((s) => s.id).join(",");
  useEffect(() => {
    if (!subIdsKey) return;
    let alive = true;
    (async () => {
      const ids = subIdsKey.split(",");
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            return [id, await getHomeworkSubtaskSubmissions(supabase, id)] as const;
          } catch {
            return [id, []] as const;
          }
        }),
      );
      if (alive) setAnswersBySub(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subIdsKey]);

  function statusChip(status: string) {
    const map: Record<string, string> = {
      graded: "bg-emerald-100 text-emerald-700",
      submitted: "bg-amber-100 text-amber-700",
    };
    const labels: Record<string, string> = {
      graded: d.teacher.statusGraded,
      submitted: d.teacher.statusPending,
    };
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", map[status] ?? "bg-slate-100 text-slate-600")}>
        {labels[status] ?? status}
      </span>
    );
  }

  return (
    <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
      <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.detailStudents}</h2>
      {subs.length === 0 ? (
        <p className="text-[14px] text-brand-ink-muted">{d.teacher.noActivity}</p>
      ) : (
        <div className="space-y-2">
          {subs.map((sub) => {
            const answers = answersBySub[sub.id] ?? [];
            const doneCount = answers.filter((a) => a.completed).length;
            const progressText = subtasks.length > 0
              ? d.homework.bundle.progressLabel.replace("{done}", String(doneCount)).replace("{total}", String(subtasks.length))
              : null;
            return (
              <div
                key={sub.id}
                className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90"
                onClick={() => setOpenSub(sub)}
              >
                <Avatar name={sub.student.full_name} url={sub.student.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">{sub.student.full_name}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {statusChip(sub.status)}
                    {progressText && <span className="text-[11px] text-brand-ink-muted">{progressText}</span>}
                    {sub.grade != null && <span className="text-[12px] font-bold text-emerald-600">{sub.grade}/5</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenSub(sub); }}
                  className={cn(
                    "shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold",
                    sub.status === "graded"
                      ? "border border-slate-200 bg-white text-brand-ink-muted hover:bg-slate-50"
                      : "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20",
                  )}
                >
                  {sub.status === "graded" ? "Открыть" : d.teacher.reviewBtn}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {openSub && (
        <BundleGradeModal
          submission={openSub}
          subtasks={subtasks}
          answers={answersBySub[openSub.id] ?? []}
          onClose={() => setOpenSub(null)}
          onGraded={(grade, comment) => {
            setSubs((prev) => prev.map((s) => (s.id === openSub.id ? { ...s, status: "graded", grade, teacher_comment: comment } : s)));
            setOpenSub(null);
          }}
        />
      )}
    </div>
  );
}
