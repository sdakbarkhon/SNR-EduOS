"use client";

// 08.08.2026 — экран AI-проверки ДЗ: список сданных работ с выбором, фильтрами
// и запуском проверки, плюс прежнее подтверждение через AiReviewModal.
//
// Экран был только про подтверждение уже проверенных работ. Запускать проверку
// было некому: крон /api/cron/homework-review-process снят (лимит кронов
// бесплатного тарифа), а сам роут ничего на вход не принимал — брал из очереди
// старейшие N. Теперь учитель выбирает конкретные работы сам.
//
// ЛОГИКА ПРОВЕРКИ И ПРОМПТЫ НЕ ТРОГАЛИСЬ, изменился только способ запуска.
// AiReviewModal не переделывалась — строка списка совместима с ней по форме
// (TeacherSubmissionForReview расширяет TeacherAiPendingReview).
//
// ГЕЙТ. Проверка пишет ai_grade/ai_feedback и ai_review_status=
// 'ai_reviewed_pending_teacher', но НЕ grade. Ученик до подтверждения видит
// «на проверке» (HomeworkDetailView сравнивает ai_review_status), настоящая
// оценка появляется у него только после AiReviewModal, которая пишет grade
// через approveAiHomeworkReview/declineAiHomeworkReview.
//
// Оформление фильтров взято из components/material-filter-styles.ts —
// пятая копия классов не заводится.

import { useMemo, useState } from "react";
import { tashkentDayKey } from "@snr/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TeacherSubmissionForReview, TeacherAiPendingReview } from "@snr/core";
import {
  ChevronLeft, ChevronDown, Sparkles, Users, BookOpen, CalendarDays,
  ListChecks, Loader2, RotateCcw, AlertTriangle,
} from "lucide-react";
import { AiReviewModal } from "@/components/teacher/ReviewModals";
import {
  filterSelectClass, withCount, FILTER_ICON, FILTER_CHEVRON, FILTER_RESET,
} from "@/components/material-filter-styles";
import { formatDayLabel } from "@/lib/material-filters";
import { AI_REVIEW_MAX_PER_CALL } from "@/lib/ai-review-batch";

// 26.08.2026: своя копия смещения снесена — счёт по Ташкенту живёт
// в одном месте, packages/core/src/utils/date.ts.

type ReviewKind = "not_reviewed" | "ai_reviewed" | "confirmed";

/** Три состояния строки из четырёх значений ai_review_status: 'pending_ai'
 *  (работа лежала в очереди снятого крона) для учителя неотличима от «не
 *  проверено» — проверка всё равно не начиналась. */
function reviewKind(status: string | null): ReviewKind {
  if (status === "teacher_approved" || status === "teacher_declined_manual_grade") return "confirmed";
  if (status === "ai_reviewed_pending_teacher") return "ai_reviewed";
  return "not_reviewed";
}

const KIND_LABEL: Record<ReviewKind, string> = {
  not_reviewed: "Не проверено",
  ai_reviewed: "Проверено ИИ",
  confirmed: "Подтверждено учителем",
};

const KIND_BADGE: Record<ReviewKind, string> = {
  not_reviewed: "bg-slate-100 text-slate-600",
  ai_reviewed: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
};

/** Почему строку нельзя выбрать, либо null если можно.
 *  Пустые ответы отсекаются не ради красоты: reviewOneSubmission() отправит
 *  в Gemini пустую строку, потратив квоту на заведомо бессмысленный вызов.
 *  У code_completion ответ лежит в отдельной колонке code_completion_answers,
 *  которую проверяющая логика не читает — трогать её здесь нельзя. */
function blockedReason(row: TeacherSubmissionForReview): string | null {
  if (reviewKind(row.ai_review_status) === "confirmed") return "Уже подтверждено учителем";
  const hasAnswer = Boolean((row.answer_text ?? "").trim() || (row.code_text ?? "").trim());
  if (!hasAnswer) return "Нет текста или кода — проверять нечего";
  return null;
}

function dayKey(iso: string): string {
  return tashkentDayKey(iso);
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/20 text-[12px] font-bold text-brand-blue">
      {initials}
    </div>
  );
}

export function TeacherAiReviewView({
  submissions,
  catalogSubjects,
}: {
  submissions: TeacherSubmissionForReview[];
  catalogSubjects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const [rows, setRows] = useState(submissions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [active, setActive] = useState<TeacherAiPendingReview | null>(null);

  const [fGroup, setFGroup] = useState("all");
  const [fSubject, setFSubject] = useState("all");
  const [fDate, setFDate] = useState("all");
  const [fStatus, setFStatus] = useState<"all" | ReviewKind>("all");

  const anyFilter = fGroup !== "all" || fSubject !== "all" || fDate !== "all" || fStatus !== "all";

  // Счётчики вариантов считаются по ВСЕМ строкам, а не по уже отфильтрованным
  // — так же, как в фильтрах материалов (buildFilterOptions). Иначе фильтр
  // нельзя «расширить» обратно: обнулившийся вариант исчезал бы из списка.
  const options = useMemo(() => {
    const groups = new Map<string, { name: string; count: number }>();
    const subjects = new Map<string, number>();
    const dates = new Map<string, number>();
    const kinds: Record<ReviewKind, number> = { not_reviewed: 0, ai_reviewed: 0, confirmed: 0 };
    for (const r of rows) {
      const gid = r.group_id || r.homework.group.name;
      const g = groups.get(gid);
      groups.set(gid, { name: r.homework.group.name, count: (g?.count ?? 0) + 1 });
      if (r.subject_name) subjects.set(r.subject_name, (subjects.get(r.subject_name) ?? 0) + 1);
      const dk = dayKey(r.submitted_at);
      dates.set(dk, (dates.get(dk) ?? 0) + 1);
      kinds[reviewKind(r.ai_review_status)] += 1;
    }
    return {
      groups: Array.from(groups.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
      subjects: Array.from(subjects.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
      dates: Array.from(dates.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => (a.key < b.key ? 1 : -1)),
      kinds,
    };
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fGroup !== "all" && (r.group_id || r.homework.group.name) !== fGroup) return false;
        if (fSubject !== "all" && r.subject_name !== fSubject) return false;
        if (fDate !== "all" && dayKey(r.submitted_at) !== fDate) return false;
        if (fStatus !== "all" && reviewKind(r.ai_review_status) !== fStatus) return false;
        return true;
      }),
    [rows, fGroup, fSubject, fDate, fStatus],
  );

  // «Выбрать все» относится к текущей выборке, а не ко всей базе.
  const selectableIds = useMemo(
    () => filtered.filter((r) => blockedReason(r) === null).map((r) => r.id),
    [filtered],
  );
  const selectedInView = selectableIds.filter((id) => selected.has(id));
  const allSelected = selectableIds.length > 0 && selectedInView.length === selectableIds.length;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const id of selectableIds) next.delete(id);
      else for (const id of selectableIds) next.add(id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setFGroup("all");
    setFSubject("all");
    setFDate("all");
    setFStatus("all");
  }

  async function runReview() {
    const ids = selectedInView;
    if (!ids.length || running) return;
    setRunning(true);
    setProgress({ done: 0, total: ids.length });
    setErrors({});

    for (let i = 0; i < ids.length; i += AI_REVIEW_MAX_PER_CALL) {
      const chunk = ids.slice(i, i + AI_REVIEW_MAX_PER_CALL);
      try {
        const res = await fetch("/api/teacher/homework/ai-review/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionIds: chunk }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

        const updated = (json.updated ?? []) as Array<{
          id: string; ai_grade: number | null; ai_feedback: unknown; ai_review_status: string | null;
        }>;
        setRows((prev) =>
          prev.map((r) => {
            const u = updated.find((x) => x.id === r.id);
            return u ? { ...r, ...u } as TeacherSubmissionForReview : r;
          }),
        );

        const results = (json.results ?? []) as Array<{ id: string; ok: boolean; error?: string }>;
        // Упавшая работа показывается в своей строке и не мешает остальным.
        setErrors((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.ok) delete next[r.id];
            else next[r.id] = r.error ?? "не удалось проверить";
          }
          return next;
        });
        setSelected((prev) => {
          const next = new Set(prev);
          for (const r of results) if (r.ok) next.delete(r.id);
          return next;
        });
      } catch (e) {
        const message = (e as Error)?.message ?? String(e);
        setErrors((prev) => {
          const next = { ...prev };
          for (const id of chunk) next[id] = message;
          return next;
        });
      }
      setProgress((p) => ({ ...p, done: Math.min(p.done + chunk.length, ids.length) }));
    }

    setRunning(false);
    router.refresh();
  }

  const failedCount = Object.keys(errors).length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/teacher/homework" className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-brand-ink">
          <Sparkles size={18} className="text-brand-blue" /> Проверка домашних заданий с ИИ
        </h1>
      </div>

      {/* ── Фильтры ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {options.groups.length > 1 && (
          <div className="relative">
            <Users className={`${FILTER_ICON} ${fGroup !== "all" ? "text-blue-500" : "text-slate-400"}`} />
            <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} className={filterSelectClass(fGroup !== "all")}>
              <option value="all">Все группы</option>
              {options.groups.map((g) => (
                <option key={g.id} value={g.id}>{withCount(g.name, g.count)}</option>
              ))}
            </select>
            <ChevronDown className={`${FILTER_CHEVRON} ${fGroup !== "all" ? "text-blue-400" : "text-slate-400"}`} />
          </div>
        )}

        {options.subjects.length > 1 && (
          <div className="relative">
            <BookOpen className={`${FILTER_ICON} ${fSubject !== "all" ? "text-blue-500" : "text-slate-400"}`} />
            <select value={fSubject} onChange={(e) => setFSubject(e.target.value)} className={filterSelectClass(fSubject !== "all")}>
              <option value="all">Все предметы</option>
              {/* Порядок и состав — из справочника school_subjects; показываем
                  только те, по которым работы реально есть. */}
              {catalogSubjects
                .filter((s) => options.subjects.some((o) => o.name === s.name))
                .map((s) => {
                  const count = options.subjects.find((o) => o.name === s.name)?.count ?? 0;
                  return <option key={s.id} value={s.name}>{withCount(s.name, count)}</option>;
                })}
            </select>
            <ChevronDown className={`${FILTER_CHEVRON} ${fSubject !== "all" ? "text-blue-400" : "text-slate-400"}`} />
          </div>
        )}

        {options.dates.length > 1 && (
          <div className="relative">
            <CalendarDays className={`${FILTER_ICON} ${fDate !== "all" ? "text-blue-500" : "text-slate-400"}`} />
            <select value={fDate} onChange={(e) => setFDate(e.target.value)} className={filterSelectClass(fDate !== "all")}>
              <option value="all">Все даты сдачи</option>
              {options.dates.map((d) => (
                <option key={d.key} value={d.key}>{withCount(formatDayLabel(d.key), d.count)}</option>
              ))}
            </select>
            <ChevronDown className={`${FILTER_CHEVRON} ${fDate !== "all" ? "text-blue-400" : "text-slate-400"}`} />
          </div>
        )}

        <div className="relative">
          <ListChecks className={`${FILTER_ICON} ${fStatus !== "all" ? "text-blue-500" : "text-slate-400"}`} />
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value as "all" | ReviewKind)}
            className={filterSelectClass(fStatus !== "all")}
          >
            <option value="all">Любой статус</option>
            <option value="not_reviewed">{withCount(KIND_LABEL.not_reviewed, options.kinds.not_reviewed)}</option>
            <option value="ai_reviewed">{withCount(KIND_LABEL.ai_reviewed, options.kinds.ai_reviewed)}</option>
            <option value="confirmed">{withCount(KIND_LABEL.confirmed, options.kinds.confirmed)}</option>
          </select>
          <ChevronDown className={`${FILTER_CHEVRON} ${fStatus !== "all" ? "text-blue-400" : "text-slate-400"}`} />
        </div>

        {anyFilter && (
          <button type="button" onClick={resetFilters} className={FILTER_RESET}>
            <RotateCcw size={15} /> Сбросить
          </button>
        )}
      </div>

      {/* ── Панель запуска ──────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-[20px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}
      >
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-brand-ink">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            disabled={running || selectableIds.length === 0}
            className="h-4 w-4 cursor-pointer accent-brand-blue"
          />
          Выбрать все ({selectableIds.length})
        </label>

        <span className="text-[13px] text-brand-ink-muted">Выбрано: {selectedInView.length}</span>

        <button
          type="button"
          onClick={runReview}
          disabled={running || selectedInView.length === 0}
          className="ml-auto flex items-center gap-2 rounded-2xl bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {running
            ? `Проверяю ${progress.done} из ${progress.total}…`
            : `Проверить с ИИ (${selectedInView.length})`}
        </button>

        {running && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-blue transition-all duration-300"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        )}

        {!running && failedCount > 0 && (
          <div className="flex w-full items-center gap-1.5 text-[12px] font-medium text-amber-700">
            <AlertTriangle size={14} /> Не удалось проверить: {failedCount}. Ошибка показана в строке.
          </div>
        )}
      </div>

      {/* ── Список работ ────────────────────────────────────────── */}
      <div
        className="overflow-hidden rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}
      >
        {filtered.length === 0 ? (
          <p className="p-5 text-[14px] text-brand-ink-muted">Под выбранные фильтры работ нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/80 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-muted">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={running || selectableIds.length === 0}
                      className="h-4 w-4 cursor-pointer accent-brand-blue"
                    />
                  </th>
                  <th className="px-3 py-3">Ученик</th>
                  <th className="px-3 py-3">Задание</th>
                  <th className="px-3 py-3">Предмет</th>
                  <th className="px-3 py-3">Группа</th>
                  <th className="px-3 py-3">Сдано</th>
                  <th className="px-3 py-3">Статус</th>
                  <th className="px-3 py-3">Оценка ИИ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const kind = reviewKind(r.ai_review_status);
                  const blocked = blockedReason(r);
                  const err = errors[r.id];
                  const canOpen = kind === "ai_reviewed";
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-white/60 text-[13px] transition-colors last:border-0 ${
                        canOpen ? "cursor-pointer hover:bg-white/90" : ""
                      } ${selected.has(r.id) ? "bg-blue-50/60" : ""}`}
                      onClick={canOpen ? () => setActive(r) : undefined}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          disabled={running || blocked !== null}
                          title={blocked ?? undefined}
                          className="h-4 w-4 cursor-pointer accent-brand-blue disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={r.student.full_name} url={r.student.avatar_url} />
                          <span className="font-semibold text-brand-ink">{r.student.full_name}</span>
                        </div>
                      </td>
                      <td className="max-w-[260px] px-3 py-3">
                        <div className="truncate text-brand-ink" title={r.homework.title}>{r.homework.title}</div>
                        {blocked && kind !== "confirmed" && (
                          <div className="mt-0.5 text-[11px] text-slate-400">{blocked}</div>
                        )}
                        {err && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
                            <AlertTriangle size={12} /> {err}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-brand-ink-muted">{r.subject_name ?? "—"}</td>
                      <td className="px-3 py-3 text-brand-ink-muted">{r.homework.group.name}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-ink-muted">
                        {formatDayLabel(dayKey(r.submitted_at))}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${KIND_BADGE[kind]}`}>
                          {KIND_LABEL[kind]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {r.ai_grade != null ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[12px] font-bold text-brand-blue">
                            {r.ai_grade}
                          </span>
                        ) : (
                          <span className="text-brand-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <AiReviewModal
          review={active}
          onClose={() => setActive(null)}
          onResolved={() => {
            // Строка не исчезает — она переходит в «Подтверждено учителем» и
            // остаётся видимой, но невыбираемой. Так учитель видит результат
            // своей работы, а не пустеющий список.
            setRows((prev) =>
              prev.map((r) => (r.id === active.id ? { ...r, ai_review_status: "teacher_approved" } : r)),
            );
            setActive(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
