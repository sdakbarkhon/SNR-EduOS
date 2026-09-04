"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDictionary, getTeacherGradeMatrix, getTestQuestions,
  getLessonGradesForGroup, type LessonGradeRow,
  averageOf, testGrade5, formatDate, tashkentDayKey,
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
import { LessonGradeDetailModal } from "./LessonGradeDetailModal";
import { Download } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSchoolNow } from "@/components/SchoolTimeProvider";
import { downloadCsv, csvFileNamePart } from "@/lib/csv";

type CategoryFilter = "all" | "assignment" | "lesson";

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
/** 24.08.2026: нормировка теста больше не своя — общая, из @snr/core.
 *  Раньше здесь делили балл на максимум, и одна и та же сдача давала 4.17 у
 *  учителя против выставленной оценки 5 у ученика. */
function testSubGrade5(s: GradeMatrixTestSub | undefined): number | null {
  if (!s) return null;
  return testGrade5(s);
}

function avgColor(avg: number | null): { bg: string; fg: string } {
  if (avg == null) return { bg: "var(--cell-pending-bg)", fg: "var(--cell-pending-fg)" };
  if (avg >= 4.5) return CELL_STYLE.graded;
  if (avg >= 3.0) return CELL_STYLE.review;
  return CELL_STYLE.missed;
}

export function TeacherGradesView({ groups, stats }: Props) {
  // Z.3, заход 3 — «сейчас» школы одной строкой на весь компонент.
  const schoolNowIso = useSchoolNow().toISOString();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();

  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [matrix, setMatrix] = useState<GradeMatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lessonGrades, setLessonGrades] = useState<LessonGradeRow[]>([]);
  const [showAllLessonGrades, setShowAllLessonGrades] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedLessonGrade, setSelectedLessonGrade] = useState<LessonGradeRow | null>(null);

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

  function cellFor(
    studentId: string, hw: GradeMatrixData["homework"][number],
  ): { state: CellState; label: string; hint?: string } {
    const now = schoolNowIso;
    const overdue = !!hw.due_date && hw.due_date < now;
    if (hw.content_type === "test") {
      const t = findTest(studentId, hw.id);
      if (!t) return { state: overdue ? "missed" : "pending", label: overdue ? "не сдано" : "—" };
      // 24.08.2026: в клетке стоит ОЦЕНКА, а не доля правильных ответов.
      // Прежняя подпись «10/12» спорила со средним в конце строки: среднее
      // считается по выставленной оценке (5), а клетка показывала 4.17.
      // Сырой балл никуда не делся — он в подсказке и в окне проверки.
      const raw = t.max_score != null ? `${t.score ?? 0}/${t.max_score}` : String(t.score ?? 0);
      if (t.grade != null) return { state: "graded", label: String(t.grade), hint: `Баллы: ${raw}` };
      // Оценки нет (старая сдача) — показываем то единственное, что есть.
      return { state: "graded", label: raw };
    }
    const f = findFile(studentId, hw.id);
    if (!f) return { state: overdue ? "missed" : "pending", label: overdue ? "не сдано" : "—" };
    if (f.status === "graded" && f.grade != null) return { state: "graded", label: String(f.grade) };
    return { state: "review", label: "на проверке" };
  }

  /**
   * Все оценки ученика, идущие в средний балл. 24.08.2026.
   *
   * Столбец «Средний» считал только по работам матрицы и не видел оценок за
   * урок, хотя они лежат на этом же экране секцией ниже. Теперь берёт оба
   * источника — как того требует общее правило (utils/gradeAverage).
   * Этапы урока сюда не приходят вовсе: их не отдаёт ни один из двух запросов.
   */
  function studentGrades(studentId: string): number[] {
    if (!matrix) return [];
    const vals: number[] = [];
    matrix.homework.forEach((h) => {
      const g5 = h.content_type === "test"
        ? testSubGrade5(findTest(studentId, h.id))
        : fileGrade5(findFile(studentId, h.id));
      if (g5 != null) vals.push(g5);
    });
    for (const r of lessonGrades) {
      if (r.student_id === studentId && r.grade != null) vals.push(r.grade);
    }
    return vals;
  }

  function studentAvg(studentId: string): number | null {
    return averageOf(studentGrades(studentId));
  }

  function assignmentAvg(hw: GradeMatrixData["homework"][number]): number | null {
    if (!matrix) return null;
    return averageOf(
      matrix.students.map((s) =>
        hw.content_type === "test"
          ? testSubGrade5(findTest(s.id, hw.id))
          : fileGrade5(findFile(s.id, hw.id)),
      ),
    );
  }

  /**
   * «Средняя по классу».
   *
   * 24.08.2026: было среднее из средних по ученикам. Разница вылезает, как
   * только у учеников разное число работ, — а тогда это число перестаёт
   * сходиться и с KPI наверху, и с карточкой той же группы в «Моих классах».
   * Теперь честное среднее по всем оценкам класса, ровно то же правило, что
   * и везде.
   */
  function overallAvg(): number | null {
    if (!matrix) return null;
    return averageOf(matrix.students.flatMap((s) => studentGrades(s.id)));
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

  /**
   * Выгрузка того, что видно на экране. 26.08.2026 — вместо
   * alert("Экспорт — доступно скоро").
   *
   * Отбор тот же, что и у экрана: выбранная группа и переключатель
   * Все/За задания/За урок. Секции идут в том же порядке и с теми же
   * заголовками, что на странице, — файл должен читаться как снимок экрана,
   * а не как отдельная выгрузка со своей логикой.
   *
   * Оценки за уроки выгружаются ВСЕ, а не первые пять: «Показать все» —
   * это сворачивание длинного списка, а не фильтр.
   */
  const hasAssignments = categoryFilter !== "lesson" && !!matrix && matrix.students.length > 0 && matrix.homework.length > 0;
  const hasLessonGrades = categoryFilter !== "assignment" && lessonGrades.length > 0;

  function exportCsv() {
    const rows: string[][] = [];

    if (hasAssignments && matrix) {
      rows.push([d.teacher.gradesExportAssignments]);
      rows.push([
        d.teacher.gradesExportStudent,
        d.teacher.groupAvgScore,
        ...matrix.homework.map((hw) =>
          hw.due_date ? `${hw.title} (${formatDate(hw.due_date, locale)})` : hw.title),
      ]);
      for (const s of matrix.students) {
        const a = studentAvg(s.id);
        rows.push([
          s.full_name,
          a != null ? a.toFixed(2) : "",
          // Прочерк на экране означает «работы нет» — в таблице это пустая
          // ячейка, иначе Excel посчитает прочерк значением.
          ...matrix.homework.map((hw) => { const l = cellFor(s.id, hw).label; return l === "—" ? "" : l; }),
        ]);
      }
      rows.push([
        d.teacher.gradesExportClassAvg,
        overall != null ? overall.toFixed(2) : "",
        ...matrix.homework.map((hw) => { const a = assignmentAvg(hw); return a != null ? a.toFixed(2) : ""; }),
      ]);
    }

    if (hasLessonGrades) {
      if (rows.length > 0) rows.push([]);
      rows.push([d.teacher.gradesExportLessonGrades]);
      rows.push([
        d.teacher.gradesExportStudent,
        d.teacher.gradesExportLesson,
        d.teacher.gradesExportTopic,
        d.teacher.reviewGrade,
        d.teacher.reviewComment,
      ]);
      for (const r of lessonGrades) {
        rows.push([
          r.student_name,
          r.lesson_no ? `${d.teacher.gradesExportLesson} ${r.lesson_no}` : formatDate(r.lesson_starts_at, locale),
          r.lesson_topic ?? "",
          r.grade != null ? String(r.grade) : "",
          r.comment ?? "",
        ]);
      }
    }

    if (rows.length === 0) return;
    const groupName = groups.find((g) => g.id === groupId)?.name ?? "";
    downloadCsv(`grades-${csvFileNamePart(groupName)}-${tashkentDayKey(schoolNowIso)}.csv`, rows);
  }

  return (
    <div className="space-y-5">
      {/* KPI — max-w здесь, а не на всей странице: у экрана и так нет своего
          cap (уже во всю ширину каркаса), но 3 карточки без ограничения
          растягивались до огромных на 1920+ (Адаптив, заход 2). */}
      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[20px] border border-white/80 bg-white/70 p-5 backdrop-blur-xl"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            <div className="text-[26px] font-bold leading-none text-brand-ink">{k.value}</div>
            <div className="mt-1 text-[13px] font-medium text-brand-ink-muted">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Все / За задания / За урок — тот же сегментированный переключатель,
          что и у ученика. Здесь страница уже состоит из 2 секций (матрица
          заданий/тестов + таблица оценок за уроки), так что фильтр просто
          управляет видимостью каждой секции, без переработки самих таблиц. */}
      <div className="flex w-fit rounded-full bg-white/70 p-1 shadow-sm">
        {([
          { value: "all", label: "Все" },
          { value: "assignment", label: "За задания" },
          { value: "lesson", label: "За урок" },
        ] as { value: CategoryFilter; label: string }[]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setCategoryFilter(opt.value)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-bold transition-all",
              categoryFilter === opt.value
                ? "bg-brand-blue text-white shadow-md"
                : "text-brand-ink-muted hover:text-brand-ink",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Top panel: group selector + export */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
          className="rounded-[12px] border border-white/80 bg-white/70 px-4 py-2 text-[14px] font-semibold text-brand-ink focus:outline-none">
          {groups.length === 0 && <option value="">Нет групп</option>}
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={exportCsv} disabled={!hasAssignments && !hasLessonGrades}
          className="flex items-center gap-2 rounded-[12px] border border-white/80 bg-white/70 px-4 py-2 text-[14px] font-semibold text-brand-ink-muted transition-colors hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-brand-ink-muted">
          <Download size={16} /> Экспорт
        </button>
      </div>

      {/* Matrix (секция "За задания") */}
      {categoryFilter !== "lesson" && (loading ? (
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
                            title={cell.hint}
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
      ))}

      {/* Lesson grades section (секция "За урок") */}
      {categoryFilter !== "assignment" && lessonGrades.length > 0 && (
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
                  <tr key={r.id} onClick={() => setSelectedLessonGrade(r)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-violet-50/40">
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

      {/* Оценка за урок — только просмотр, правку не делаем в этой задаче */}
      {selectedLessonGrade && (
        <LessonGradeDetailModal
          row={selectedLessonGrade}
          t={d.grades.detailModal}
          onClose={() => setSelectedLessonGrade(null)}
        />
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
