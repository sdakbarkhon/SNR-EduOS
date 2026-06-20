"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getDictionary,
  getSubjectConfig,
  getHomeworkAttachmentUrl,
  uploadHomeworkAttachment,
  setHomeworkAttachment,
  deleteHomeworkAttachment,
  getHomeworkTestsUrl,
} from "@snr/core";
import { Code2 } from "lucide-react";
import { TeacherProgrammingSubmissions } from "./TeacherProgrammingSubmissions";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ChevronLeft, Download, FileText, Paperclip, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { ReviewModal, TestReviewModal } from "@/components/teacher/ReviewModals";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  options: Array<{ id: string; option_text: string; is_correct: boolean }>;
};
type Submission = {
  id: string; student_id: string; status: string;
  submitted_at: string | null; answer_text: string | null;
  code_text: string | null;
  grade: number | null; teacher_comment: string | null;
  file_storage_path: string | null; file_original_name: string | null;
  student: { id: string; full_name: string; avatar_url: string | null };
};
type TestSub = {
  id: string; student_id: string;
  score: number | null; max_score: number | null; grade: number | null;
  submitted_at: string;
  student: { id: string; full_name: string; avatar_url: string | null };
};
type HW = {
  id: string; title: string; description: string | null;
  content_type: string; due_date: string | null;
  teacher_id: string | null;
  attachment_storage_path: string | null;
  attachment_filename: string | null;
  attachment_size_bytes: number | null;
  test_duration_seconds: number | null;
  test_auto_grade: boolean;
  programming_language: "python" | "cpp" | null;
  expected_output: string | null;
  tests_attachment_path: string | null;
  tests_attachment_filename: string | null;
  group: { id: string; name: string; subject: string };
};

interface Props {
  hw: HW;
  submissions: Submission[];
  testSubs: TestSub[];
  questions: Question[];
}

const MAX_ATTACH_BYTES = 50 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function downloadViaLink(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20 text-[13px] font-bold text-brand-blue">
      {initials}
    </div>
  );
}

function AttachmentCard({
  hw,
  onDeleted,
  onAttached,
}: {
  hw: HW;
  onDeleted: () => void;
  onAttached: (path: string, size: number, name: string) => void;
}) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [err, setErr] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_ATTACH_BYTES) { setErr("Файл больше 50 МБ"); e.target.value = ""; return; }
    setErr("");
    setPendingFile(f);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.size > MAX_ATTACH_BYTES) { setErr("Файл больше 50 МБ"); return; }
    setErr("");
    setPendingFile(f);
  };

  const handleUpload = async () => {
    if (!pendingFile || !hw.teacher_id) return;
    setUploading(true);
    setErr("");
    try {
      const { path, sizeByte } = await uploadHomeworkAttachment(sb, {
        teacherId: hw.teacher_id,
        homeworkId: hw.id,
        fileName: pendingFile.name,
        blob: pendingFile,
      });
      await setHomeworkAttachment(sb, hw.id, { path, sizeByte, fileName: pendingFile.name });
      onAttached(path, sizeByte, pendingFile.name);
      setPendingFile(null);
    } catch {
      setErr(d.common.error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!hw.attachment_storage_path) return;
    setDlLoading(true);
    try {
      const name = hw.attachment_filename ?? hw.attachment_storage_path.split("/").pop() ?? "file";
      const url = await getHomeworkAttachmentUrl(sb, hw.attachment_storage_path, name);
      downloadViaLink(url, name);
    } finally {
      setDlLoading(false);
    }
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleDelete = async () => {
    if (!hw.attachment_storage_path) return;
    setDelLoading(true);
    try {
      await deleteHomeworkAttachment(sb, hw.id, hw.attachment_storage_path);
      onDeleted();
    } finally {
      setDelLoading(false);
    }
  };

  if (hw.attachment_storage_path) {
    const name = hw.attachment_filename ?? hw.attachment_storage_path.split("/").pop() ?? "file";
    const size = hw.attachment_size_bytes ? formatBytes(hw.attachment_size_bytes) : null;
    return (
      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-brand-ink-muted">
          {d.teacher.hwAttachLabel}
        </p>
        <div className="flex items-center gap-3 rounded-[12px] border border-slate-100 bg-white/80 p-3">
          <FileText size={16} className="shrink-0 text-brand-blue" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-700">{name}</p>
            {size && <p className="text-[11px] text-slate-400">{size}</p>}
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={dlLoading}
            className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold text-brand-blue hover:bg-blue-50 disabled:opacity-50"
          >
            <Download size={12} />
            {d.teacher.hwDownloadAttach}
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={delLoading}
            className="rounded-[8px] p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <ConfirmModal
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
          title={d.teacher.hwDeleteAttachConfirm}
          variant="danger"
          confirmText="Удалить"
          cancelText={d.common.cancel}
        />
      </div>
    );
  }

  // No attachment yet — show dropzone
  return (
    <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-brand-ink-muted">
        {d.teacher.hwAttachLabel}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,video/mp4"
        onChange={handleFileChange}
        className="hidden"
        id="attach-input"
      />
      {pendingFile ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-[12px] border border-brand-blue/40 bg-blue-50/60 p-3">
            <Paperclip size={14} className="shrink-0 text-brand-blue" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-brand-blue">{pendingFile.name}</p>
              <p className="text-[11px] text-slate-500">{formatBytes(pendingFile.size)}</p>
            </div>
            <button type="button" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-slate-400 hover:text-red-500">
              <X size={14} />
            </button>
          </div>
          {err && <p className="text-[12px] text-red-500">{err}</p>}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full rounded-[10px] py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}
          >
            {uploading ? d.teacher.hwAttachProgress : d.teacher.hwAttachBtn}
          </button>
        </div>
      ) : (
        <label
          htmlFor="attach-input"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-slate-200 py-6 text-center transition-all hover:border-brand-blue/40 hover:bg-blue-50/20"
        >
          <Paperclip size={18} className="text-slate-400" />
          <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.hwAttachBtn}</span>
          <span className="text-[11px] text-slate-400">PDF, DOCX, PPTX, XLSX, JPG, PNG, MP4 · до 50 МБ</span>
        </label>
      )}
      {err && !pendingFile && <p className="mt-1 text-[12px] text-red-500">{err}</p>}
    </div>
  );
}

export function TeacherHomeworkDetailView({ hw: initialHw, submissions, testSubs, questions }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();

  const [hw, setHw] = useState(initialHw);
  const [reviewSub, setReviewSub] = useState<Submission | null>(null);
  const [reviewTestSub, setReviewTestSub] = useState<TestSub | null>(null);
  const [localSubs, setLocalSubs] = useState(submissions);
  const [localTestSubs, setLocalTestSubs] = useState(testSubs);

  const cfg = getSubjectConfig(hw.group.subject);

  const hasOpenQuestions = questions.some(q => q.question_type === "open");

  const fileGrades = localSubs.filter(s => s.grade != null).map(s => Number(s.grade));
  const testGrades = localTestSubs
    .filter(s => s.max_score != null && s.max_score > 0)
    .map(s => ((s.score ?? 0) / s.max_score!) * 5);
  const allGrades = [...fileGrades, ...testGrades];
  const avgGrade = allGrades.length > 0
    ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length
    : 0;

  const submittedCount = localSubs.length + localTestSubs.length;
  const gradedTestSubs = localTestSubs.filter(s =>
    !hasOpenQuestions || s.max_score === questions.length
  ).length;
  const gradedCount = localSubs.filter(s => s.status === "graded").length + gradedTestSubs;

  function statusChip(status: string, isTest = false, pending = false) {
    if (isTest) {
      if (pending) {
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          {d.teacher.statusPending}
        </span>;
      }
      return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        {d.teacher.statusGraded}
      </span>;
    }
    const map: Record<string, string> = {
      graded: "bg-emerald-100 text-emerald-700",
      submitted: "bg-amber-100 text-amber-700",
      overdue: "bg-red-100 text-red-700",
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
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/teacher/homework" className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold text-brand-ink">{hw.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-brand-ink-muted">{hw.group.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              hw.content_type === "test" ? "bg-violet-100 text-violet-700"
                : hw.content_type === "programming" ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700")}>
              {hw.content_type === "test" ? d.homework.typeTest
                : hw.content_type === "programming" ? d.homework.typeProgramming
                : d.homework.typeFile}
            </span>
          </div>
          {hw.content_type === "test" && (
            <p className="mt-1 text-[11px] text-brand-ink-muted">
              {d.homework.test.info
                .replace("{q}", String(questions.length))
                .replace("{min}", hw.test_duration_seconds ? String(Math.round(hw.test_duration_seconds / 60)) : "—")
                .replace("{grade}", hw.test_auto_grade ? d.homework.test.autoGradeOn : d.homework.test.autoGradeOff)}
            </p>
          )}
          {hw.content_type === "programming" && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-brand-ink-muted">
              <Code2 size={12} /> {hw.programming_language === "cpp" ? "C++" : "Python"}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: d.teacher.detailSubmitted, value: submittedCount },
          { label: d.teacher.detailAvgScore, value: avgGrade > 0 ? avgGrade.toFixed(1) : "—" },
          {
            label: d.teacher.statsPending,
            value: localSubs.filter(s => s.status === "submitted").length
              + localTestSubs.filter(s => hasOpenQuestions && s.max_score !== questions.length).length
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[16px] bg-white/70 border border-white/80 p-4 text-center"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <div className="text-[24px] font-bold text-brand-ink">{item.value}</div>
            <div className="text-[12px] text-brand-ink-muted">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {hw.description && (
        <div className="rounded-[16px] bg-white/70 border border-white/80 p-4 text-[14px] text-brand-ink">
          {hw.description}
        </div>
      )}

      {/* Programming info (expected output + tests file) */}
      {hw.content_type === "programming" && (hw.expected_output || hw.tests_attachment_path) && (
        <div className="rounded-[16px] bg-white/70 border border-white/80 p-4 space-y-3">
          {hw.expected_output && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-ink-muted">{d.homework.programming.expectedLabel}</p>
              <pre className="overflow-auto rounded-lg bg-[#1e1e1e] p-2.5 text-[12px] text-slate-100" style={{ fontFamily: "'JetBrains Mono',Monaco,monospace" }}>{hw.expected_output}</pre>
            </div>
          )}
          {hw.tests_attachment_path && (
            <button
              onClick={async () => {
                const url = await getHomeworkTestsUrl(createClient(), hw.tests_attachment_path!, hw.tests_attachment_filename ?? "tests").catch(() => null);
                if (url) window.open(url, "_blank");
              }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 hover:underline"
            >
              <Download size={13} /> {d.homework.programming.testsFile}: {hw.tests_attachment_filename}
            </button>
          )}
        </div>
      )}

      {/* Attachment card (file homework only) */}
      {hw.content_type === "file" && (
        <AttachmentCard
          hw={hw}
          onDeleted={() => setHw(h => ({
            ...h,
            attachment_storage_path: null,
            attachment_filename: null,
            attachment_size_bytes: null,
          }))}
          onAttached={(path, size, name) => setHw(h => ({
            ...h,
            attachment_storage_path: path,
            attachment_size_bytes: size,
            attachment_filename: name,
          }))}
        />
      )}

      {/* Test questions (teacher view with correct answers) */}
      {hw.content_type === "test" && questions.length > 0 && (
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-3"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
          <h2 className="text-[15px] font-bold text-brand-ink">Вопросы ({questions.length})</h2>
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-[14px] bg-slate-50 p-3 space-y-2">
              <div className="text-[13px] font-semibold text-brand-ink">{i + 1}. {q.question_text}</div>
              {q.question_type === "single_choice" && (
                <div className="space-y-1">
                  {q.options.map((o) => (
                    <div key={o.id} className={cn("flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px]",
                      o.is_correct ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-brand-ink-muted")}>
                      <span className={cn("h-3 w-3 rounded-full border-2 shrink-0",
                        o.is_correct ? "border-emerald-500 bg-emerald-500" : "border-slate-300")} />
                      {o.option_text}
                      {o.is_correct && <span className="ml-auto text-[10px] font-bold text-emerald-600">{d.teacher.reviewCorrect}</span>}
                    </div>
                  ))}
                </div>
              )}
              {q.question_type === "open" && (
                <div className="text-[12px] text-brand-ink-muted italic">Открытый вопрос — оценивается учителем</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Programming submissions (code viewer + inline grade) */}
      {hw.content_type === "programming" ? (
        <TeacherProgrammingSubmissions
          language={hw.programming_language ?? "python"}
          submissions={localSubs}
        />
      ) : (
      /* Submissions list */
      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.detailStudents}</h2>
        {localSubs.length === 0 && localTestSubs.length === 0 ? (
          <p className="text-[14px] text-brand-ink-muted">{d.teacher.noActivity}</p>
        ) : (
          <div className="space-y-2">
            {localSubs.map((sub) => (
              <div key={sub.id}
                className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90"
                onClick={() => setReviewSub(sub)}>
                <Avatar name={sub.student.full_name} url={sub.student.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">{sub.student.full_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {statusChip(sub.status)}
                    {sub.grade != null && (
                      <span className="text-[12px] font-bold text-emerald-600">{sub.grade}/5</span>
                    )}
                  </div>
                </div>
                {sub.status === "submitted" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewSub(sub); }}
                    className="shrink-0 rounded-[10px] bg-brand-blue/10 px-3 py-1.5 text-[12px] font-semibold text-brand-blue hover:bg-brand-blue/20">
                    {d.teacher.reviewBtn}
                  </button>
                )}
                {sub.status === "graded" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewSub(sub); }}
                    className="shrink-0 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink-muted hover:bg-slate-50">
                    Открыть
                  </button>
                )}
              </div>
            ))}

            {localTestSubs.map((sub) => {
              const isGraded = !hasOpenQuestions || sub.max_score === questions.length;
              const needsReview = !isGraded;
              return (
                <div key={sub.id}
                  className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90"
                  onClick={() => setReviewTestSub(sub)}>
                  <Avatar name={sub.student.full_name} url={sub.student.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-brand-ink">{sub.student.full_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {statusChip("", true, needsReview)}
                      {sub.score !== null && sub.max_score !== null && (
                        <span className="text-[12px] font-semibold text-slate-500">
                          {sub.score}/{sub.max_score}
                          {sub.max_score > 0 && ` (${Math.round((sub.score / sub.max_score) * 100)}%)`}
                        </span>
                      )}
                      {sub.grade != null && (
                        <span className="text-[12px] font-bold text-emerald-600">{sub.grade}/5</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewTestSub(sub); }}
                    className={cn(
                      "shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold",
                      needsReview
                        ? "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
                        : "border border-slate-200 bg-white text-brand-ink-muted hover:bg-slate-50"
                    )}>
                    {needsReview ? d.teacher.reviewBtn : "Открыть"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {reviewSub && (
        <ReviewModal
          submission={reviewSub}
          onClose={() => setReviewSub(null)}
          onGraded={(grade, comment) => {
            setLocalSubs(subs => subs.map(s =>
              s.id === reviewSub.id ? { ...s, status: "graded", grade, teacher_comment: comment } : s
            ));
            setReviewSub(null);
            router.refresh();
          }}
        />
      )}

      {reviewTestSub && (
        <TestReviewModal
          testSub={reviewTestSub}
          questions={questions}
          onClose={() => setReviewTestSub(null)}
          onGraded={(score, maxScore) => {
            setLocalTestSubs(subs => subs.map(s =>
              s.id === reviewTestSub.id ? { ...s, score, max_score: maxScore } : s
            ));
            setReviewTestSub(null);
          }}
        />
      )}
    </div>
  );
}
