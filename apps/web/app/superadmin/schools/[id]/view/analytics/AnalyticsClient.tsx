"use client";

import { useMemo, useState } from "react";
import {
  getDictionary, type Locale,
  averageGrade, attendanceRate, countsTowardAverage,
  type AnalyticsGrade, type AnalyticsAttendance, type GradeSource,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ViewStat } from "@/components/superadmin/ViewTable";

/**
 * Аналитика школы глазами суперадмина. Заход 3 по среднему баллу, 30.08.2026.
 *
 * ЧТО ЗДЕСЬ БЫЛО. Страница считала два разных средних об одной школе и
 * показывала их рядом: «Средняя оценка» 3.94 — только по lesson_grades, и
 * «Средняя за работы» 4.81 — только по homework_submissions. Первое
 * расходилось с админским числом на 0.44 просто потому, что считало другое.
 * Обе формулы были написаны прямо в странице, седьмой и восьмой копией
 * усреднения в продукте.
 *
 * ЧТО СТАЛО. Факты собирает общий сбор (collectAnalyticsFacts) по тем же
 * источникам, что у администратора, а считает общее правило из ядра
 * (averageGrade → averageOfGrades). Своей арифметики на этой странице нет ни
 * строки, поэтому число суперадмина об одной школе теперь равно админскому.
 *
 * ПОЧЕМУ РАЗБИВКА, А НЕ «СРЕДНЯЯ ЗА ДЗ». Плитка про домашние задания
 * показывала одну четверть картины и выглядела как вся. Вместо неё — четыре
 * источника рядом: видно, из чего сложилось общее число, и видно, если
 * какой-то источник в школе пуст.
 *
 * ПРОЧЕРК, А НЕ НОЛЬ. Пустая школа раньше показывала «0» — то же, что школа,
 * где все получили нули. Теперь там «—»: нечего показать и нечего считать.
 */

type Period = "all" | "30" | "90";

export type SuperAnalyticsFacts = {
  grades: AnalyticsGrade[];
  attendance: AnalyticsAttendance[];
  lessonsTotal: number;
  lessonsDone: number;
  /** «Сегодня» ПРОСМАТРИВАЕМОЙ школы, не смотрящего: у демо оно заморожено. */
  todayIso: string;
};

function minusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Подписи источников. Русский зашит намеренно: соседние экраны суперадмина
 *  устроены так же, а свой словарь ради четырёх строк заводить не стали. */
const ИСТОЧНИКИ: ReadonlyArray<{ source: GradeSource; label: string }> = [
  { source: "homework_submissions", label: "Домашние задания" },
  { source: "test_submissions", label: "Тесты" },
  { source: "project_submissions", label: "Проекты" },
  { source: "lesson_grades", label: "Оценки за урок" },
];

/** Число для плитки: прочерк, если считать не из чего. */
function показать(v: number | null, знаков = 2): string {
  return v == null ? "—" : v.toFixed(знаков);
}

/** Выбор периода. Свой, а не общий: у администратора он тоже локальный
 *  (AnalyticsView), наружу его никто не выносил, и тащить общий компонент
 *  ради одного выпадающего списка не за чем. */
function Select({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function AnalyticsClient({ facts }: { facts: SuperAnalyticsFacts }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin as unknown as Record<string, string>;
  const a = getDictionary(locale as Locale).admin;

  const [period, setPeriod] = useState<Period>("all");

  /** Границы периода — от «сегодня» ШКОЛЫ. У демо оно заморожено на 29.07;
   *  считай мы от реальных часов, окно уехало бы вперёд её данных и экран
   *  показал бы пустоту при полной школе. */
  const { from, to } = useMemo(() => {
    const today = facts.todayIso;
    if (period === "all") {
      const all = [...facts.grades, ...facts.attendance]
        .map((r) => (r.date ?? "").slice(0, 10)).filter(Boolean).sort();
      return { from: all[0] ?? today, to: all.at(-1) ?? today };
    }
    const days = Number(period);
    return { from: minusDays(today, days), to: today };
  }, [period, facts.todayIso, facts.grades, facts.attendance]);

  const вПериоде = useMemo(() => {
    const внутри = <T extends { date: string }>(rows: T[]) =>
      rows.filter((r) => {
        const d = (r.date ?? "").slice(0, 10);
        return d >= from && d <= to;
      });
    return { grades: внутри(facts.grades), attendance: внутри(facts.attendance) };
  }, [facts.grades, facts.attendance, from, to]);

  const общее = averageGrade(вПериоде.grades);
  const посещ = attendanceRate(вПериоде.attendance);
  // Считаем по тому же правилу: оценки за этапы урока в счёт не идут, и
  // числа под плитками должны это отражать.
  const вСреднем = вПериоде.grades.filter((g) => countsTowardAverage(g.sourceTable) && g.grade5 != null);

  const поИсточникам = ИСТОЧНИКИ.map((и) => {
    const строки = вПериоде.grades.filter((g) => g.sourceTable === и.source);
    return { ...и, среднее: averageGrade(строки), сколько: строки.filter((g) => g.grade5 != null).length };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onChange={(v) => setPeriod(v as Period)} options={[
          { value: "all", label: a.anPeriodAll },
          { value: "30", label: a.anPeriod30 },
          { value: "90", label: a.anPeriod90 },
        ]} />
      </div>

      <section>
        <h2 className="text-[17px] font-bold text-gray-900">{t.svOverviewCounts ?? ""}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <ViewStat label={t.svAnLessons ?? ""} value={facts.lessonsTotal} />
          <ViewStat label={t.svAnLessonsDone ?? ""} value={facts.lessonsDone} />
          <ViewStat label={t.svAnGrades ?? ""} value={вСреднем.length} />
          <ViewStat label={t.svAnAvgGrade ?? ""} value={показать(общее)} />
          <ViewStat label={t.svAnAttendance ?? ""} value={показать(посещ, 0)} />
        </div>
      </section>

      {/* Из чего сложилось общее число. Источник, у которого в школе нет ни
          одной оценки, показывает прочерк и ноль — это тоже ответ. */}
      <section>
        <h2 className="text-[17px] font-bold text-gray-900">{t.svAnBySource ?? ""}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {поИсточникам.map((и) => (
            <ViewStat
              key={и.source}
              label={`${и.label} · ${и.сколько}`}
              value={показать(и.среднее)}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-gray-500">{t.svAnBySourceNote ?? ""}</p>
      </section>
    </div>
  );
}
