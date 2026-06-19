"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Check, FileText, TestTube2, BookOpen, Code2, Pencil } from "lucide-react";
import type { Classwork, ClassworkQuestion, ClassworkSubmissionWithStudent, ClassworkType } from "@snr/core";
import {
  getClasswork, createClasswork, createClassworkQuestions, deleteClasswork,
  getClassworkSubmissions, gradeClasswork, getDictionary,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

const TYPE_ICONS: Record<ClassworkType, React.ReactNode> = {
  file:        <FileText className="w-4 h-4" />,
  test:        <TestTube2 className="w-4 h-4" />,
  learning:    <BookOpen className="w-4 h-4" />,
  programming: <Code2 className="w-4 h-4" />,
};

type Props = {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  teacherId: string;
  groupId: string;
};

type NewQuestion = { question_text: string; options: string[]; correct_index: number };

export function ClassworkModal({ open, onClose, lessonId, teacherId, groupId }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const db = createClient();

  const [tab, setTab] = useState<"task" | "submissions">("task");
  const [classwork, setClasswork] = useState<Classwork | null>(null);
  const [submissions, setSubmissions] = useState<ClassworkSubmissionWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState<ClassworkType>("file");
  const [duration, setDuration] = useState(10); // minutes
  const [questions, setQuestions] = useState<NewQuestion[]>([]);

  // Grade state per submission id
  const [grades, setGrades] = useState<Record<string, { grade: string; comment: string; saving: boolean }>>({});
  // Which graded submission is in edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db2 = db as any;
      const { data: studentRows } = await db2
        .from("student_groups")
        .select("student:students(id, full_name, avatar_url)")
        .eq("group_id", groupId);
      const groupStudents = (
        (studentRows ?? []) as Array<{ student: { id: string; full_name: string; avatar_url: string | null } }>
      )
        .map((r) => r.student)
        .filter(Boolean) as Array<{ id: string; full_name: string; avatar_url: string | null }>;

      const cw = await getClasswork(db as never, lessonId);
      setClasswork(cw);
      if (cw) {
        setTitle(cw.title);
        setDescription(cw.description ?? "");
        setWorkType(cw.work_type);
        if (cw.duration_seconds) setDuration(Math.round(cw.duration_seconds / 60));
        setQuestions(
          cw.questions.map((q) => ({
            question_text: q.question_text,
            options: q.options,
            correct_index: q.correct_index,
          })),
        );
        const subs = await getClassworkSubmissions(db as never, cw.id, groupStudents);
        setSubmissions(subs);
        const gradeMap: typeof grades = {};
        for (const s of subs) {
          gradeMap[s.id] = { grade: s.grade?.toString() ?? "", comment: s.teacher_comment ?? "", saving: false };
        }
        setGrades(gradeMap);
      }
    } finally {
      setLoading(false);
    }
  }, [lessonId, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const cwId = await createClasswork(db as never, {
        lessonId, teacherId,
        title: title.trim(),
        description: description.trim() || undefined,
        workType,
        durationSeconds: workType === "test" ? duration * 60 : undefined,
      });
      if (workType === "test" && questions.length > 0) {
        await createClassworkQuestions(
          db as never, cwId,
          questions.map((q, i) => ({
            questionText: q.question_text,
            options: q.options,
            correctIndex: q.correct_index,
            position: i,
          })),
        );
      }
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!classwork) return;
    if (!window.confirm(d.teacher.classworkDeleteConfirm)) return;
    await deleteClasswork(db as never, classwork.id, teacherId);
    setClasswork(null);
    setTitle(""); setDescription(""); setWorkType("file"); setQuestions([]);
    setSubmissions([]);
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { question_text: "", options: ["", "", "", ""], correct_index: 0 }]);
  }

  function updateQuestion(i: number, patch: Partial<NewQuestion>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function updateOption(qi: number, oi: number, val: string) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, oidx) => (oidx === oi ? val : o)) } : q,
      ),
    );
  }

  async function handleGrade(submissionId: string) {
    const g = grades[submissionId];
    if (!g) return;
    const gradeNum = parseInt(g.grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 5) return;
    setGrades((prev) => ({
      ...prev,
      [submissionId]: { grade: prev[submissionId]?.grade ?? "", comment: prev[submissionId]?.comment ?? "", saving: true },
    }));
    try {
      await gradeClasswork(db as never, { submissionId, teacherId, grade: gradeNum, comment: g.comment });
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, grade: gradeNum, teacher_comment: g.comment || null, graded_at: new Date().toISOString() }
            : s,
        ),
      );
      setEditingId(null);
    } finally {
      setGrades((prev) => ({
        ...prev,
        [submissionId]: { grade: prev[submissionId]?.grade ?? "", comment: prev[submissionId]?.comment ?? "", saving: false },
      }));
    }
  }

  const TYPES: ClassworkType[] = ["file", "test", "learning", "programming"];
  const typeLabels: Record<ClassworkType, string> = {
    file: d.teacher.classworkTypeFile,
    test: d.teacher.classworkTypeTest,
    learning: d.teacher.classworkTypeLearning,
    programming: d.teacher.classworkTypeProgramming,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-[var(--surface-1)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text-1)]">{d.teacher.classworkModalTitle}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] px-6">
          {(["task", "submissions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 pr-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              {t === "task" ? d.teacher.classworkTabTask : d.teacher.classworkTabSubmissions}
              {t === "submissions" && submissions.length > 0 && (
                <span className="ml-1.5 text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full">
                  {submissions.filter((s) => s.submitted_at).length}/{submissions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === "task" ? (
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">
                  {d.teacher.classworkTitleLabel}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!!classwork}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">
                  {d.teacher.classworkDescLabel}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!!classwork}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm resize-none focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-2">
                  {d.teacher.classworkTypeLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      disabled={!!classwork}
                      onClick={() => setWorkType(t)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors disabled:opacity-60 ${
                        workType === t
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--text-3)]"
                      }`}
                    >
                      {TYPE_ICONS[t]}
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration — test only, creation mode */}
              {workType === "test" && !classwork && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">
                    Длительность теста (мин)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-32 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}
              {classwork && classwork.work_type === "test" && classwork.duration_seconds && (
                <p className="text-sm text-[var(--text-3)]">
                  Длительность: {Math.round(classwork.duration_seconds / 60)} мин
                </p>
              )}

              {/* Test questions — creation mode */}
              {workType === "test" && !classwork && (
                <div className="space-y-3">
                  {questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-3)] w-5">{qi + 1}.</span>
                        <input
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qi, { question_text: e.target.value })}
                          placeholder={d.teacher.classworkQuestionText}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-sm text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                          className="p-1 text-[var(--text-3)] hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2 pl-7">
                          <button
                            onClick={() => updateQuestion(qi, { correct_index: oi })}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              q.correct_index === oi ? "border-green-500 bg-green-500" : "border-[var(--border)]"
                            }`}
                          >
                            {q.correct_index === oi && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <input
                            value={opt}
                            onChange={(e) => updateOption(qi, oi, e.target.value)}
                            placeholder={`${d.teacher.classworkQuestionOption} ${oi + 1}`}
                            className="flex-1 px-2 py-1 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-sm text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={addQuestion}
                    className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    {d.teacher.classworkAddQuestion}
                  </button>
                </div>
              )}

              {/* Existing test questions preview */}
              {classwork && classwork.work_type === "test" && classwork.questions.length > 0 && (
                <div className="space-y-2">
                  {classwork.questions.map((q, i) => (
                    <div key={q.id} className="text-sm text-[var(--text-2)] pl-2">
                      {i + 1}. {q.question_text}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!classwork ? (
                  <button
                    onClick={handleSave}
                    disabled={!title.trim() || saving}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-sm font-medium disabled:opacity-50 transition-opacity"
                  >
                    {saving ? d.teacher.classworkSavingBtn : d.teacher.classworkSaveBtn}
                  </button>
                ) : (
                  <button
                    onClick={handleDelete}
                    className="py-2.5 px-4 rounded-xl border border-red-500/30 text-red-500 text-sm hover:bg-red-500/10 transition-colors"
                  >
                    {d.teacher.classworkDeleteBtn}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Submissions tab */
            <div className="space-y-3">
              {submissions.length === 0 ? (
                <p className="text-center py-8 text-[var(--text-3)] text-sm">{d.teacher.classworkNoSubmissions}</p>
              ) : (
                submissions.map((s) => {
                  const hasSubmission = !!s.submitted_at;
                  const isGraded = s.grade != null;
                  const isEditing = editingId === s.id;
                  const g = grades[s.id];
                  return (
                    <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      {/* Student row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                            {s.student.full_name[0]}
                          </div>
                          <span className="text-sm font-medium text-[var(--text-1)]">{s.student.full_name}</span>
                        </div>
                        {isGraded && !isEditing ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-500">
                            {d.teacher.classworkGradedLabel}: {s.grade}/5
                          </span>
                        ) : hasSubmission ? (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400">
                            {d.teacher.classworkSubmittedLabel}
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--surface-1)] text-[var(--text-3)]">—</span>
                        )}
                      </div>

                      {hasSubmission && s.test_score != null && (
                        <p className="text-xs text-[var(--text-3)] mb-2">
                          {d.teacher.classworkTestScore
                            .replace("{score}", String(s.test_score))
                            .replace("{max}", String(s.test_max ?? "?"))}
                        </p>
                      )}

                      {hasSubmission && s.text_answer && (
                        <p className="text-xs text-[var(--text-2)] bg-[var(--surface-1)] rounded-lg p-2 mb-2 line-clamp-2">
                          {s.text_answer}
                        </p>
                      )}

                      {/* Read-only grade view */}
                      {hasSubmission && isGraded && !isEditing && (
                        <div className="mt-2 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-green-600">Оценка: {s.grade}/5</p>
                            {s.teacher_comment && (
                              <p className="text-xs text-[var(--text-3)]">{s.teacher_comment}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setEditingId(s.id)}
                            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                          >
                            <Pencil className="w-3 h-3" />
                            Редактировать
                          </button>
                        </div>
                      )}

                      {/* Grade form — ungraded or currently editing */}
                      {hasSubmission && (!isGraded || isEditing) && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={g?.grade ?? ""}
                              onChange={(e) =>
                                setGrades((prev) => ({
                                  ...prev,
                                  [s.id]: { grade: e.target.value, comment: prev[s.id]?.comment ?? "", saving: false },
                                }))
                              }
                              className="w-16 px-2 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-sm text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]"
                              placeholder="1–5"
                            />
                            <input
                              type="text"
                              value={g?.comment ?? ""}
                              onChange={(e) =>
                                setGrades((prev) => ({
                                  ...prev,
                                  [s.id]: { grade: prev[s.id]?.grade ?? "", comment: e.target.value, saving: false },
                                }))
                              }
                              placeholder={`${d.teacher.classworkCommentLabel} (опционально)`}
                              className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-sm text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]"
                            />
                            <button
                              onClick={() => handleGrade(s.id)}
                              disabled={g?.saving}
                              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                            >
                              {g?.saving ? "…" : d.teacher.classworkGradeBtn}
                            </button>
                          </div>
                          {isEditing && (
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)]"
                            >
                              Отмена
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
