"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDictionary, getSubjectConfig, getTeacherGradeMatrix, getTestQuestions,
  getLessonGradesForGroup, type LessonGradeRow,
} from "@snr/core";
import type {
  Locale, GradeMatrixData, GradeMatrixFileSub, GradeMatrixTestSub,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import {
  ReviewModal, TestReviewModal,
  type ReviewSubmission, type ReviewTestSub, type ReviewQuestion,
} from "@/components/teacher/ReviewModals";
import { Download } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  groups: Array<{ id: string; name: string; subject: string }>;
  stats: { totalGraded: number; avgGrade: number; weeklyGraded: number };
}

type CellState = "graded" | "review" | "missed" | "pending";
const CELL_STYLE: Record<CellState, { bg: string; fg: string }> = {
  graded: { bg: "var(--cell-graded-bg)", fg: "var(--cell-graded-fg)" },
  review: { bg: "var(--cell-review-bg)", fg: "var(--cell-review-fg)" },
  missed: { bg: "var(--cell-missed-bg)", fg: "var(--cell-missed-fg)" },
  pending: { bg: "var(--cell-pending-bg)", fg: "var(--cell-pending-fg)" },
};

const STUDENT_W = 200;
const AVG_W = 90;

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** grade5 (нормировано к /5) для одной работы ученика. */
function fileGrade5(s: GradeMatrixFileSub | undefined): number | null {
  if (!s || s.status !== "graded" || s.grade == null) return null;
  return s.grade;
}
function testGrade5(s: GradeMatrixTestSub | undefined): number | null {
  if (!s || s.score == null) return null;
  const m = s.max_score ?? 0;
  return m > 0 ? (s.score / m) * 5 : null;
}

function avgColor(avg: number | null): { bg: string; fg: string } {
  if (avg == null) return { bg: "var(--cell-pending-bg)", fg: "var(--cell-pending-fg)" };
  if (avg >= 4.5) return CELL_STYLE.graded;
  if (avg >= 3.0) return CELL_STYLE.review;
  return CELL_STYLE.missed;
}

export function TeacherGradesView({ groups, stats }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();

  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [matrix, setMatrix] = useState<GradeMatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lessonGrades, setLessonGrades] = useState<LessonGradeRow[]>([]);
  const [showAllLessonGrades, setShowAllLessonGrades] = useState(false);

  // Review modal state
  const [reviewSub, setReviewSub] = useState<ReviewSubmission | null>(null);
  const [reviewTest, setReviewTest] = useState<{ sub: ReviewTestSub; questions: ReviewQuestion[] } | null>(null);

  const loadMatrix = useCallback(async (gid: string) => {
    if (!gid) { setMatrix(null); return; }
    setLoading(true);
    try {
      const data = await getTeacherGradeMatrix(supabase as never, gid);
      setMatrix(data);
    } catch (e) {
      console.error("[TeacherGradesView] getTeacherGradeMatrix failed:", (e as Error)?.message ?? e);
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadMatrix(groupId); }, [groupId, loadMatrix]);

  useEffect(() => {
    if (!groupId) return;
    getLessonGradesForGroup(supabase as never, groupId).then(setLessonGrades).catch((e) => {
      console.error("[TeacherGradesView] getLessonGradesForGroup failed:", e?.message ?? e);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const kpis = [
    { label: "Всего оценил", value: stats.totalGraded },
    { label: "Средний балл", value: stats.avgGrade > 0 ? stats.avgGrade.toFixed(1) : "—" },
    { label: "Оценено за неделю", value: stats.weeklyGraded },
  ];

  function findFile(studentId: string, hwId: string) {
    return matrix?.fileSubs.find((f) => f.student_id === studentId && f.homework_id === hwId);
  }
  function findTest(studentId: string, hwId: string) {
    return matrix?.testSubs.find((t) => t.student_id === studentId && t.homework_id === hwId);
  }

  function cellFor(studentId: string, hw: GradeMatrixData["homework"][number]): { state: CellState; label: string } {
    const now = new Date().toISOString();
    const overdue = !!hw.due_date && hw.due_date < now;
    if (hw.content_type === "test") {
      const t = findTest(studentId, hw.id);
      if (!t) return { state: overdue ? "missed" : "pending", label: overdue ? "не сдано" : "—" };
      // Показываем score/max — иначе «2/2» (100%) читается как двойка.
      const label = t.max_score != null ? `${t.score ?? 0}/${t.max_score}` : String(t.score ?? 0);
      return { state: "graded", label };
    }
    const f = findFile(studentId, hw.id);
    if (!f) return { state: overdue ? "missed" : "pending", label: overdue ? "не сдано" : "—" };
    if (f.status === "graded" && f.grade != null) return { state: "graded", label: String(f.grade) };
    return { state: "review", label: "на проверке" };
  }

  function studentAvg(studentId: string): number | null {
    if (!matrix) return null;
    const vals: number[] = [];
    matrix.homework.forEach((h) => {
      const g5 = h.content_type === "test"
        ? testGrade5(findTest(studentId, h.id))
        : fileGrade5(findFile(studentId, h.id));
      if (g5 != null) vals.push(g5);
    });
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function assignmentAvg(hw: GradeMatrixData["homework"][number]): number | null {
    if (!matrix) return null;
    const vals: number[] = [];
    matrix.students.forEach((s) => {
      const g5 = hw.content_type === "test"
        ? testGrade5(findTest(s.id, hw.id))
        : fileGrade5(findFile(s.id, hw.id));
      if (g5 != null) vals.push(g5);
    });
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function overallAvg(): number | null {
    if (!matrix) return null;
    const vals: number[] = [];
    matrix.students.forEach((s) => { const a = studentAvg(s.id); if (a != null) vals.push(a); });
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  async function onCellClick(studentId: string, hw: GradeMatrixData["homework"][number]) {
    if (!matrix) return;
    const student = matrix.students.find((s) => s.id === studentId);
    if (!student) return;

    if (hw.content_type === "test") {
      const t = findTest(studentId, hw.id);
      if (!t) return;
      let questions: ReviewQuestion[] = [];
      try { questions = (await getTestQuestions(supabase as never, hw.id)) as unknown as ReviewQuestion[]; } catch { /* empty */ }
      setReviewTest({
        sub: { id: t.id, student_id: t.student_id, score: t.score, max_score: t.max_score, submitted_at: t.submitted_at, student },
        questions,
      });
    } else {
      const f = findFile(studentId, hw.id);
      if (!f) return;
      setReviewSub({
        id: f.id, student_id: f.student_id, status: f.status,
        submitted_at: f.submitted_at, answer_text: f.answer_text,
        grade: f.grade, teacher_comment: f.teacher_comment,
        file_storage_path: (f as { file_storage_path?: string | null }).file_storage_path ?? null,
        file_original_name: (f as { file_original_name?: string | null }).file_original_name ?? null,
        student,
      });
    }
  }

  const overall = overallAvg();
  const stickyBg = "var(--glass-bg)";

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-brand-ink">Журнал оценок</h1>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[20px] border border-white/80 bg-white/70 p-5 backdrop-blur-xl"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            <div className="text-[26px] font-bold leading-none text-brand-ink">{k.value}</div>
            <div className="mt-1 text-[13px] font-medium text-brand-ink-muted">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Top panel: group selector + export */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
          className="rounded-[12px] border border-white/80 bg-white/70 px-4 py-2 text-[14px] font-semibold text-brand-ink focus:outline-none">
          {groups.length === 0 && <option value="">Нет групп</option>}
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={() => alert("Экспорт — доступно скоро")}
          className="flex items-center gap-2 rounded-[12px] border border-white/80 bg-white/70 px-4 py-2 text-[14px] font-semibold text-brand-ink-muted transition-colors hover:text-brand-ink">
          <Download size={16} /> Экспорт
        </button>
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="rounded-[20px] border border-white/80 bg-white/70 p-8 text-center text-brand-ink-muted">{d.common.loading}</div>
      ) : !matrix || matrix.students.length === 0 ? (
        <div className="rounded-[20px] border border-white/80 bg-white/70 p-8 text-center text-brand-ink-muted">
          В этой группе нет учеников.
        </div>
      ) : matrix.homework.length === 0 ? (
        <div className="rounded-[20px] border border-white/80 bg-white/70 p-8 text-center text-brand-ink-muted">
          В этой группе пока нет заданий.
        </div>
      ) : (
        <div className="overflow-auto rounded-[20px] border border-white/60 bg-white/70 backdrop-blur-xl"
          style={{ maxHeight: "70vh", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
          <table className="border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-100 px-4 py-3 text-left text-[12px] font-bold text-brand-ink-muted"
                  style={{ minWidth: STUDENT_W, background: stickyBg }}>Ученик</th>
                <th className="sticky top-0 z-30 border-b border-r border-slate-100 px-2 py-3 text-center text-[12px] font-bold text-brand-ink-muted"
                  style={{ left: STUDENT_W, minWidth: AVG_W, background: stickyBg }}>Средний</th>
                {matrix.homework.map((hw) => (
                  <th key={hw.id} className="sticky top-0 z-20 border-b border-slate-100 px-3 py-2 text-center align-bottom"
                    style={{ minWidth: 104, background: stickyBg }}>
                    <span className={cn("mb-1 inline-block rounded-[6px] px-1.5 py-0.5 text-[9px] font-semibold",
                      hw.content_type === "test" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>
                      {hw.content_type === "test" ? d.homework.typeTest : d.homework.typeFile}
                    </span>
                    <div className="text-[12px] font-bold text-brand-ink">
                      {hw.due_date ? new Date(hw.due_date).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Tashkent" }) : "—"}
                    </div>
                    <div className="mx-auto max-w-[90px] truncate text-[10px] font-medium text-brand-ink-muted">{hw.title}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.students.map((s) => {
                const avg = studentAvg(s.id);
                const ac = avgColor(avg);
                return (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-2.5"
                      style={{ background: stickyBg }}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-[11px] font-bold text-brand-blue">
                          {initials(s.full_name)}
                        </span>
                        <span className="truncate text-[13px] font-semibold text-brand-ink">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="sticky z-10 border-b border-r border-slate-100 p-1.5 text-center"
                      style={{ left: STUDENT_W, background: stickyBg }}>
                      <div className="mx-auto flex h-9 items-center justify-center rounded-[10px] text-[15px] font-bold"
                        style={{ background: ac.bg, color: ac.fg }}>
                        {avg != null ? avg.toFixed(1) : "—"}
                      </div>
                    </td>
                    {matrix.homework.map((hw) => {
                      const cell = cellFor(s.id, hw);
                      const style = CELL_STYLE[cell.state];
                      const clickable = cell.state === "graded" || cell.state === "review";
                      return (
                        <td key={hw.id} className="border-b border-slate-100 p-1.5 text-center">
                          <div
                            onClick={clickable ? () => onCellClick(s.id, hw) : undefined}
                            className={cn("mx-auto flex h-12 min-w-[72px] items-center justify-center rounded-[10px] font-bold",
                              cell.state === "graded" ? (cell.label.length <= 2 ? "text-[24px]" : "text-[16px]") : "text-[11px]",
                              clickable && "cursor-pointer transition-transform hover:scale-[1.04]")}
                            style={{ background: style.bg, color: style.fg }}>
                            {cell.label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-30 border-t border-r border-slate-100 px-4 py-3 text-[12px] font-bold text-brand-ink"
                  style={{ background: stickyBg }}>Средняя по классу</td>
                <td className="sticky bottom-0 z-30 border-t border-r border-slate-100 p-1.5 text-center"
                  style={{ left: STUDENT_W, background: stickyBg }}>
                  <div className="mx-auto flex h-9 items-center justify-center rounded-[10px] text-[15px] font-bold"
                    style={{ ...((): { background: string; color: string } => { const c = avgColor(overall); return { background: c.bg, color: c.fg }; })() }}>
                    {overall != null ? overall.toFixed(1) : "—"}
                  </div>
                </td>
                {matrix.homework.map((hw) => {
                  const a = assignmentAvg(hw);
                  return (
                    <td key={hw.id} className="sticky bottom-0 z-20 border-t border-slate-100 p-1.5 text-center text-[13px] font-bold text-brand-ink"
                      style={{ background: stickyBg }}>
                      {a != null ? a.toFixed(1) : "—"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Lesson grades section */}
      {lessonGrades.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-slate-400">
            Оценки за уроки
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Ученик</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Урок</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Тема</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-400">Оценка</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {(showAllLessonGrades ? lessonGrades : lessonGrades.slice(0, 5)).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-violet-50/40">
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.student_name}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.lesson_no ? `Урок ${r.lesson_no}` : new Date(r.lesson_starts_at).toLocaleDateString("ru", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" })}
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate text-slate-600">{r.lesson_topic ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                        {r.grade}/5
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-slate-500 italic">
                      {r.comment ? `«${r.comment}»` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lessonGrades.length > 5 && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowAllLessonGrades((v) => !v)}
                className="rounded-[10px] border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-600"
              >
                {showAllLessonGrades ? "Свернуть" : `Показать все (${lessonGrades.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Review modals */}
      {reviewSub && (
        <ReviewModal
          submission={reviewSub}
          onClose={() => setReviewSub(null)}
          onGraded={() => { setReviewSub(null); loadMatrix(groupId); }}
        />
      )}
      {reviewTest && (
        <TestReviewModal
          testSub={reviewTest.sub}
          questions={reviewTest.questions}
          onClose={() => setReviewTest(null)}
          onGraded={() => { setReviewTest(null); loadMatrix(groupId); }}
        />
      )}
    </div>
  );
}
