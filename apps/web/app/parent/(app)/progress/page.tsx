import type {
  Gradient,
  ProgressGrade,
  ProgressMonthPoint,
  ProgressPeriod,
  ProgressReview,
  ProgressSubject,
  ProgressViewData,
} from "./ProgressView";
import { getSubjectStyle } from "@snr/core";
import { ProgressView } from "./ProgressView";
import { getParentContext } from "@/lib/parent-context";
import { getDemoNowMs } from "@/lib/demo-date";
import {
  childAttendanceRecords,
  childDailyStatus,
  childGrades,
  childGradesSummary,
  childTeacherReviews,
  childWeekActivity,
  getSelectedChild,
  parentToday,
  parentUnreadCount,
} from "@/lib/parent-queries";
import {
  avatarGradient,
  givenNameLetter,
  initialsOf,
  previousDay,
  relativeStamp,
  tashkentDay,
} from "../_ui/format";
import type { SubjectKey } from "../v2/tokens";

/**
 * «Успехи» (П10) — серверная сборка view-model из РЕАЛЬНЫХ данных Supabase.
 *
 * Раньше страница рисовала фикстуры ../v2/data (чужой ребёнок, выдуманные
 * средние, радар навыков). Теперь единственный источник цифр — оценки ребёнка
 * из getStudentGrades (6 источников, нормировано к /5) плюс посещаемость,
 * недельная активность и текстовые отзывы учителей. Всё через
 * lib/parent-queries, которые ВСЕГДА передают studentId выбранного ребёнка
 * (без него родительский RLS вернул бы объединение по всем детям).
 *
 * Средние, разбивка по предметам, дельты и «сильные стороны / зоны роста»
 * считаются из ОДНОГО набора оценок — иначе карточка «Средний балл» и строки
 * предметов расходились бы (разные core-запросы считают средний по разным
 * подмножествам). getChildGradesSummary используется только как справочник
 * subjectName → subjectId, чтобы плитки предметов вели на /parent/subject/[id].
 *
 * Вкладки «Навыки» нет: под неё нет ни таблицы, ни core-запроса (см. коммент
 * в packages/core/src/queries/index.ts) — см. также заголовок ProgressView.tsx.
 */

/* ─── Предметы: цветовая схема v2 по названию предмета ────────────────────── */

const SUBJECT_GLYPH: Record<SubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** У предметов в БД нет ключа палитры v2 (только name/icon/color), поэтому
 *  сопоставляем по названию, а незнакомое — стабильным хешем: один и тот же
 *  предмет обязан получать один и тот же цвет на всех экранах и рендерах. */
const SUBJECT_PATTERNS: readonly (readonly [RegExp, SubjectKey])[] = [
  [/матем|алгебр|геометр/i, "math"],
  [/англ|english/i, "eng"],
  [/рус|литерат/i, "rus"],
  [/робот|robot|ардуин|arduino/i, "robo"],
  [/програм|информат|код|python|scratch|web|веб/i, "prog"],
];

const SUBJECT_KEYS: readonly SubjectKey[] = ["prog", "robo", "math", "eng", "rus"];

function subjectKeyOf(name: string): SubjectKey {
  for (const [re, key] of SUBJECT_PATTERNS) {
    if (re.test(name)) return key;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_KEYS[hash % SUBJECT_KEYS.length] ?? "prog";
}

/* ─── Месяцы ──────────────────────────────────────────────────────────────── */

const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
] as const;

const MONTHS_PREP = [
  "январе", "феврале", "марте", "апреле", "мае", "июне",
  "июле", "августе", "сентябре", "октябре", "ноябре", "декабре",
] as const;

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
] as const;

/** «2026-07» → индекс месяца 0..11. */
function monthIndex(monthKey: string): number {
  const n = Number(monthKey.slice(5, 7));
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n - 1 : 0;
}

function monthLabel(monthKey: string, currentYear: string): string {
  const name = MONTHS_NOM[monthIndex(monthKey)] ?? monthKey;
  const year = monthKey.slice(0, 4);
  return year === currentYear ? name : `${name} ${year}`;
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toGradient(g: readonly [string, string]): Gradient {
  return [g[0], g[1]];
}

/* ─── Страница ────────────────────────────────────────────────────────────── */

export default async function ParentProgressPage() {
  const ctx = await getParentContext();
  const child = await getSelectedChild();
  const bellCount = await parentUnreadCount();

  const parentInitials = ctx?.parentName ? initialsOf(ctx.parentName) : "?";

  if (!child) {
    const empty: ProgressViewData = {
      parent: { initials: parentInitials },
      bellCount,
      child: null,
      childLoadError: Boolean(ctx?.hadError),
      subjects: [],
      grades: [],
      periods: [],
      defaultPeriod: "all",
      attendance: { pct: 0, present: 0, total: 0 },
      weekActivity: { thisWeek: 0, lastWeek: 0, deltaPct: null },
      reviews: [],
      dynamics: [],
    };
    return <ProgressView data={empty} />;
  }

  const today = parentToday();
  const [rawGrades, summary, attendance, weekActivity, reviews, dayStatus] = await Promise.all([
    childGrades(),
    childGradesSummary(),
    childAttendanceRecords(),
    childWeekActivity(),
    childTeacherReviews({ limit: 5 }),
    childDailyStatus(today),
  ]);

  /* ── Оценки: единственный источник всех средних на экране ───────────────── */

  const grades: ProgressGrade[] = rawGrades
    .filter((g): g is typeof g & { grade5: number } => g.grade5 != null)
    // subject у getStudentGrades — СЛАГ («programming»), а у
    // getChildGradesSummary — русское название. Приводим к названию сразу
    // здесь, чтобы все производные срезы (список предметов, средние по
    // предмету, динамика) считались по одному и тому же ключу.
    .map((g) => ({
      subject: g.subject ? getSubjectStyle(g.subject).label : "",
      grade5: g.grade5,
      month: tashkentDay(g.date).slice(0, 7),
    }));

  /* ── Справочник предметов (id нужен для /parent/subject/[id]) ───────────── */

  // getStudentGrades отдаёт subject СЛАГОМ (getSubjectKeyByLabel:
  // «Программирование» → "programming"), а getChildGradesSummary — уже
  // человеческим названием. Без развёртки слага экран показывал в списке
  // предметов «programming/math/russian» вместо русских названий.
  const idByName = new Map(summary.subjects.map((s) => [s.subjectName, s.subjectId]));
  const names = new Set<string>([...summary.subjects.map((s) => s.subjectName), ...grades.map((g) => g.subject)]);
  const subjectList: ProgressSubject[] = Array.from(names)
    .filter((n) => n.length > 0)
    .map((name) => {
      const key = subjectKeyOf(name);
      return { id: idByName.get(name) ?? null, name, key, glyph: SUBJECT_GLYPH[key] };
    });

  /* ── Периоды: только месяцы, в которых реально есть оценки ──────────────── */

  const currentYear = today.slice(0, 4);
  const monthsDesc = Array.from(new Set(grades.map((g) => g.month))).sort((a, b) => b.localeCompare(a));

  const periods: ProgressPeriod[] = monthsDesc.slice(0, 6).map((m) => ({
    id: m,
    label: monthLabel(m, currentYear),
    prepLabel: MONTHS_PREP[monthIndex(m)] ?? m,
  }));
  periods.push({ id: "all", label: "Всё время", prepLabel: "прошлом периоде" });

  const defaultPeriod = monthsDesc[0] ?? "all";

  /* ── Динамика: средний балл по месяцам (последние 6 с данными) ──────────── */

  const dynamics: ProgressMonthPoint[] = monthsDesc
    .slice(0, 6)
    .reverse()
    .map((m) => ({
      monthKey: m,
      label: MONTHS_SHORT[monthIndex(m)] ?? m,
      avg: averageOf(grades.filter((g) => g.month === m).map((g) => g.grade5)) ?? 0,
    }));

  /* ── Отзывы учителей ────────────────────────────────────────────────────── */

  const yesterday = previousDay(today);
  const reviewItems: ProgressReview[] = reviews.map((r) => {
    const teacherName = r.teacherName ?? "Учитель";
    return {
      id: r.id,
      teacherName,
      teacherInitials: initialsOf(teacherName),
      teacherGradient: toGradient(avatarGradient(teacherName)),
      subjectName: r.subjectName ?? "",
      subjectId: r.subjectName ? idByName.get(r.subjectName) ?? null : null,
      timeLabel: relativeStamp(r.gradedAt, today, yesterday),
      comment: r.comment,
    };
  });

  /* ── Статус дня для чипа в карточке ребёнка ─────────────────────────────── */
  // «Сейчас» берём из демо-часов (lib/demo-date), а не из getChildDailyStats:
  // тот сравнивает уроки с РЕАЛЬНЫМ Date.now(), и при замороженной демо-дате
  // «следующий урок» получился бы неверным.

  const nowIso = new Date(getDemoNowMs()).toISOString();
  const statusLabel =
    dayStatus.totalLessons > 0 &&
    dayStatus.attendedCount > 0 &&
    dayStatus.lessons.some((l) => l.startsAt > nowIso)
      ? "В школе"
      : null;

  const gradient = avatarGradient(child.id);

  const data: ProgressViewData = {
    parent: { initials: parentInitials },
    bellCount,
    child: {
      fullName: child.full_name,
      initial: givenNameLetter(child.full_name),
      className: child.className ?? "",
      gradient: toGradient(gradient),
      statusLabel,
    },
    subjects: subjectList,
    grades,
    periods,
    defaultPeriod,
    attendance: {
      pct: attendance.stats.percentage,
      present: attendance.stats.present,
      total: attendance.stats.total,
    },
    weekActivity,
    reviews: reviewItems,
    dynamics,
  };

  return <ProgressView data={data} />;
}
