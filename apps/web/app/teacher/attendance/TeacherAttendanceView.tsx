"use client";

import { useRouter } from "next/navigation";
import { getDictionary, type Locale, type AttendanceStatus, type TeacherAttendanceGroupRow } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ClipboardCheck, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Матрица = {
  lessons: Array<{ id: string; topic: string | null; starts_at: string }>;
  students: Array<{ id: string; full_name: string }>;
  matrix: Record<string, Record<string, AttendanceStatus | null>>;
  noAuthor: Record<string, true>;
  groupAvgPct: number;
};

/**
 * Сводка посещаемости у учителя. Пункт 255, 03.09.2026.
 *
 * ЗДЕСЬ ТОЛЬКО СМОТРЯТ. Правка отметок живёт в перекличке урока, и второго
 * места ей заводить нельзя: два места правки одного — это два замка, которые
 * однажды разойдутся. В перекличке есть контекст урока и оба замка сразу —
 * правило доступа (`is_finalized = false ИЛИ marked_by IS NULL`) и пятнадцать
 * минут из `markLockState`.
 *
 * ШИРИНА МАТРИЦЫ. Месяц на тридцать учеников — это шестьсот клеток, и на
 * планшете их пришлось бы прокручивать вбок вслепую. Поэтому по умолчанию
 * видны ПОСЛЕДНИЕ двенадцать уроков месяца, а прошлые доступны прокруткой
 * влево — как в бумажном журнале, где свежая страница открыта, а прошлые
 * перелистываются. Сколько уроков спрятано, написано словами: молчаливое
 * усечение читалось бы как потеря данных. Имя ученика не уезжает — первый
 * столбец липкий.
 */
const ВИДНО_УРОКОВ = 12;

export function TeacherAttendanceView({
  groups,
  month,
  summary,
  selectedGroupId,
  matrix,
}: {
  groups: Array<{ id: string; name: string }>;
  month: string;
  summary: TeacherAttendanceGroupRow[];
  selectedGroupId: string | null;
  matrix: Матрица | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.attendance;
  const router = useRouter();

  const имя = new Map(groups.map((g) => [g.id, g.name] as const));
  const сводка = summary
    .filter((r) => имя.has(r.groupId))
    .sort((a, b) => (имя.get(a.groupId) ?? "").localeCompare(имя.get(b.groupId) ?? ""));

  function перейти(next: { month?: string; group?: string | null }) {
    const p = new URLSearchParams();
    p.set("month", next.month ?? month);
    const g = next.group === undefined ? selectedGroupId : next.group;
    if (g) p.set("group", g);
    router.push(`/teacher/attendance?${p.toString()}`);
  }

  /** «2026-07» ± N месяцев. Счёт по UTC: у месяца часового пояса нет. */
  function сдвиг(на: number): string {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1 + на, 1)).toISOString().slice(0, 7);
  }

  const подпись = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString(
      locale === "en" ? "en-US" : locale === "uz" ? "uz-UZ" : "ru-RU",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
  })();

  const уроки = matrix ? matrix.lessons.slice(-ВИДНО_УРОКОВ) : [];
  const скрыто = matrix ? matrix.lessons.length - уроки.length : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ClipboardCheck className="h-6 w-6 shrink-0 text-blue-600" />
        <h1 className="flex-1 text-[22px] font-bold text-brand-ink">{t.teacherTitle}</h1>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => перейти({ month: сдвиг(-1) })}
            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-bold text-slate-700">{подпись}</span>
          <button
            onClick={() => перейти({ month: сдвиг(1) })}
            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Фильтр по классу: «Все группы» плюс кнопка на каждый. Тот же приём,
          что у домашних заданий — список короткий, прятать его незачем. */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => перейти({ group: null })}
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all",
            selectedGroupId === null
              ? "bg-brand-blue text-white shadow-md shadow-brand-blue/25"
              : "border border-slate-200 bg-white/70 text-brand-ink-muted hover:bg-white",
          )}
        >
          {t.teacherAllGroups}
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => перейти({ group: g.id })}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all",
              selectedGroupId === g.id
                ? "bg-brand-blue text-white shadow-md shadow-brand-blue/25"
                : "border border-slate-200 bg-white/70 text-brand-ink-muted hover:bg-white",
            )}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* ── Сводка по классам ─────────────────────────────────────────── */}
      {сводка.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
          {t.teacherMatrixEmpty}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {сводка
            .filter((r) => !selectedGroupId || r.groupId === selectedGroupId)
            .map((r) => (
              <div key={r.groupId} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-900">{имя.get(r.groupId)}</span>
                  <span className="shrink-0 text-lg font-bold text-emerald-600">{r.percent}%</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{t.teacherAvgPct}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
                  <span className="text-slate-500">{t.teacherLegendPresent}</span>
                  <span className="text-right font-bold text-slate-700">{r.present}</span>
                  <span className="text-slate-500">{t.calendarLegendExcused}</span>
                  <span className="text-right font-bold text-slate-700">{r.excused}</span>
                  <span className="text-slate-500">{t.teacherLegendAbsent}</span>
                  <span className="text-right font-bold text-slate-700">{r.unexcused}</span>
                  {r.noAuthor > 0 && (
                    <>
                      <span className="flex items-center gap-1 text-amber-700">
                        {t.teacherNoAuthor}
                        <span title={t.teacherNoAuthorHint}>
                          <HelpCircle className="h-3 w-3" />
                        </span>
                      </span>
                      <span className="text-right font-bold text-amber-700">{r.noAuthor}</span>
                    </>
                  )}
                </div>
                <p className="mt-2 border-t border-slate-50 pt-2 text-[11px] text-slate-400">
                  {t.teacherMarksCount.replace("{n}", String(r.total))}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* ── Матрица ученик × урок ─────────────────────────────────────── */}
      {selectedGroupId && matrix && matrix.students.length > 0 && matrix.lessons.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm font-bold text-slate-900">{имя.get(selectedGroupId)}</span>
            {скрыто > 0 && (
              <span className="text-[11px] text-slate-400">
                {t.teacherOlderHidden.replace("{n}", String(скрыто))}
              </span>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />{t.teacherLegendPresent}
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-sm bg-amber-400" />{t.calendarLegendExcused}
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-sm bg-red-500" />{t.teacherLegendAbsent}
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-sm bg-slate-200" />{t.teacherLegendNone}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    {t.teacherGroupLabel}
                  </th>
                  {уроки.map((l) => (
                    <th
                      key={l.id}
                      className="px-1 py-1.5 text-[10px] font-semibold text-gray-400"
                      title={l.topic ?? ""}
                    >
                      {new Date(l.starts_at).toLocaleDateString("ru-RU", {
                        day: "2-digit", month: "2-digit", timeZone: "Asia/Tashkent",
                      })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.students.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-10 max-w-[12rem] truncate bg-white px-2 py-1 text-xs font-medium text-slate-700">
                      {s.full_name}
                    </td>
                    {уроки.map((l) => {
                      const st = matrix.matrix[s.id]?.[l.id] ?? null;
                      const безАвтора = !!matrix.noAuthor[`${s.id}::${l.id}`];
                      return (
                        <td key={l.id} className="px-1 py-1">
                          <span
                            title={безАвтора ? t.teacherNoAuthorHint : undefined}
                            className={cn(
                              "block h-5 w-5 rounded-sm",
                              st === "present" ? "bg-emerald-500"
                                : st === "absent_excused" ? "bg-amber-400"
                                : st === "absent_unexcused" ? "bg-red-500"
                                : "bg-slate-200",
                              // Отметка без автора обведена: это не чужая
                              // проверка, и учитель вправе поправить её в
                              // перекличке даже после запирания (миграция 225).
                              безАвтора && "ring-2 ring-amber-600 ring-offset-1",
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
