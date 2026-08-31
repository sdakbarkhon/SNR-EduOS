// Расчёты общей аналитики школы.
//
// ПОЧЕМУ ЗДЕСЬ, А НЕ В ЭКРАНЕ. Средний балл и посещаемость уже считаются в
// нескольких местах приложения, и правило нормировки оценки к пятибалльной
// живёт в getStudentGrades (queries/index.ts) — единственном месте, которое
// собирает оценки из шести источников. Аналитика берёт готовые строки оттуда и
// только группирует их. Своего способа посчитать средний балл она не заводит:
// разойдись он с экраном оценок хоть на десятую, директор и учитель увидели бы
// разные числа по одному ученику.
//
// 30.08.2026 — ЗАХОД 3. Своего способа тут и правда не было, а вот своя
// АРИФМЕТИКА была: averageGrade усредняла всё подряд, потому что источник
// оценки до неё не доезжал — сбор фактов сворачивал строку и признак терял.
// Из-за этого у администратора выходило 4.37 там, где по общему правилу
// 4.38: в среднее подмешивались оценки за этапы урока, которые в него не
// идут. Теперь AnalyticsGrade несёт sourceTable, а averageGrade зовёт
// averageOfGrades из utils/gradeAverage — то самое единственное правило.
//
// ВСЕ ФУНКЦИИ ЧИСТЫЕ. Ни одна не ходит в базу: на вход — плоские строки фактов,
// на выход — числа. Поэтому их поведение проверяемо без базы, а экран может
// пересчитывать всё при смене фильтра, не дёргая сервер.

import { attendancePercent, ATTENDANCE_LOW_THRESHOLD } from "./derive";
import { averageOfGrades, type GradeSource } from "../utils/gradeAverage";

// ── Пороги ───────────────────────────────────────────────────────────────────
//
// Числа собраны здесь, а не рассыпаны по коду: их будут спорить и менять, и
// менять надо в одном месте. Каждое подписано, почему оно такое.

/** Сколько оценок нужно, чтобы вообще судить об ученике.
 *  Три оценки — не повод для вывода: одна двойка из трёх даёт средний 3.3 и
 *  отправила бы отличника в отстающие. Пять — минимальная выборка, при которой
 *  одна случайная оценка не переворачивает картину. */
export const MIN_GRADES_FOR_VERDICT = 5;

/** Сколько отметок посещаемости нужно, чтобы говорить о пропусках. Один
 *  пропуск из двух уроков — это 50%, но это не прогульщик, это два урока. */
export const MIN_ATTENDANCE_FOR_VERDICT = 5;

/** Отличник: средний балл не ниже. */
export const EXCELLENT_FROM = 4.5;

/** Признак «низкие оценки»: средний балл ниже. */
export const LOW_GRADE_BELOW = 3.5;

/** Признак «много несданного»: столько и больше просроченных работ. */
export const OVERDUE_FROM = 2;

/** Насколько должен сдвинуться средний балл, чтобы считать это переменой, а не
 *  колебанием. Полбалла на пятибалльной шкале — это заметно человеку. */
export const TREND_DELTA = 0.5;

/** Сколько оценок нужно в КАЖДОЙ половине периода, чтобы говорить о динамике.
 *  Меньше четырёх — и «ухудшение» окажется одной случайной тройкой. */
export const MIN_GRADES_PER_HALF = 4;

// ── Входные факты ────────────────────────────────────────────────────────────

export type AnalyticsGrade = {
  studentId: string;
  groupName: string;
  /** Ключ предмета; пустая строка — предмет не определён у записи. */
  subject: string;
  /** ISO-дата работы. */
  date: string;
  /** Оценка, приведённая к пятибалльной. null — не оценено. */
  grade5: number | null;
  /**
   * Таблица, из которой пришла оценка.
   *
   * БЕЗ НЕЁ СРЕДНИЙ БАЛЛ СЧИТАТЬ НЕЛЬЗЯ: правило (utils/gradeAverage)
   * разделяет оценки по источнику, а не по автору, и оценки за этапы урока
   * в средний балл не идут. Поле обязательное намеренно — необязательное
   * молча вернуло бы прежнюю ошибку у любого, кто про него забудет.
   */
  sourceTable: GradeSource;
  /** Название работы. Своего справочника тем у оценок нет, а название работы —
   *  ровно то, что учитель узнаёт; по нему ищутся просевшие темы. */
  title?: string;
};

export type AnalyticsAttendance = {
  studentId: string;
  groupName: string;
  subject: string;
  date: string;
  present: boolean;
};

export type AnalyticsWork = {
  studentId: string;
  groupName: string;
  subject: string;
  /** Дата сдачи (для сданных) либо срок (для просроченных). */
  date: string;
};

export type AnalyticsInput = {
  grades: AnalyticsGrade[];
  attendance: AnalyticsAttendance[];
  submitted: AnalyticsWork[];
  overdue: AnalyticsWork[];
};

// ── Основные величины ────────────────────────────────────────────────────────

/**
 * Средний балл — по общему правилу продукта.
 *
 * Своей арифметики здесь больше нет: averageOfGrades сам отбрасывает
 * источники, которые в средний балл не идут (оценки за этапы урока), и сам
 * пропускает неоценённые работы — они не «ноль», их просто не проверили.
 * Пустой список даёт null, а не 0.
 */
export function averageGrade(grades: AnalyticsGrade[]): number | null {
  return averageOfGrades(grades);
}

/** Посещаемость в процентах: присутствовал / всего отметок.
 *  Считает та же функция, что и на экранах ученика и родителя
 *  (presenters/derive.ts) — уважительный пропуск и неуважительный одинаково
 *  считаются отсутствием, потому что вопрос здесь «был ли на уроке». */
export function attendanceRate(rows: AnalyticsAttendance[]): number | null {
  if (rows.length === 0) return null;
  return attendancePercent(rows.map((r) => ({ status: r.present ? "present" : "absent_unexcused" })) as never);
}

// ── Ученик ───────────────────────────────────────────────────────────────────

/** Признак риска. Их три, и они НЕ складываются в один балл намеренно:
 *  ученик с тройками, но ходящий на все уроки, и ученик, переставший ходить —
 *  это две разные беды, и решать их будут по-разному. Экран показывает, какие
 *  именно признаки сработали, а не общую «оценку риска». */
export type RiskFlag = "low_grades" | "low_attendance" | "overdue_work";

export type StudentStat = {
  studentId: string;
  gradeCount: number;
  attendanceCount: number;
  avgGrade: number | null;
  attendance: number | null;
  submittedCount: number;
  overdueCount: number;
  /** Сработавшие признаки риска. Пустой массив — рисков нет ЛИБО судить рано. */
  risks: RiskFlag[];
  /** Данных мало — вывод не делаем ни в какую сторону. */
  tooLittleData: boolean;
  /** Сдвиг среднего балла: вторая половина периода минус первая.
   *  null — оценок в одной из половин слишком мало, чтобы говорить о динамике. */
  trend: number | null;
};

export function computeStudentStats(input: AnalyticsInput, studentIds: string[]): StudentStat[] {
  const byStudent = <T extends { studentId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const cur = m.get(r.studentId);
      if (cur) cur.push(r); else m.set(r.studentId, [r]);
    }
    return m;
  };
  const g = byStudent(input.grades);
  const a = byStudent(input.attendance);
  const s = byStudent(input.submitted);
  const o = byStudent(input.overdue);

  return studentIds.map((studentId) => {
    const grades = (g.get(studentId) ?? []).filter((x) => x.grade5 != null);
    const att = a.get(studentId) ?? [];
    const overdueCount = (o.get(studentId) ?? []).length;

    const avgGrade = averageGrade(grades);
    const attendance = attendanceRate(att);

    // Судим отдельно по каждому признаку: у ученика может хватать оценок, но
    // не хватать отметок посещаемости, и наоборот. Общий запрет «мало данных»
    // выключил бы оба вывода из-за нехватки в одном.
    const gradesEnough = grades.length >= MIN_GRADES_FOR_VERDICT;
    const attendanceEnough = att.length >= MIN_ATTENDANCE_FOR_VERDICT;

    const risks: RiskFlag[] = [];
    if (gradesEnough && avgGrade != null && avgGrade < LOW_GRADE_BELOW) risks.push("low_grades");
    if (attendanceEnough && attendance != null && attendance < ATTENDANCE_LOW_THRESHOLD) risks.push("low_attendance");
    // Просроченная работа — факт, а не статистика: две несданные это две
    // несданные независимо от того, сколько у ученика оценок.
    if (overdueCount >= OVERDUE_FROM) risks.push("overdue_work");

    return {
      studentId,
      gradeCount: grades.length,
      attendanceCount: att.length,
      avgGrade,
      attendance,
      submittedCount: (s.get(studentId) ?? []).length,
      overdueCount,
      risks,
      // «Мало данных» — про оценки: именно по ним делается вывод «отличник» и
      // «низкие оценки», и именно там ошибка выборки дороже всего.
      tooLittleData: !gradesEnough,
      trend: gradeTrend(grades),
    };
  });
}

/**
 * Динамика: средний балл второй половины периода минус средний первой.
 *
 * Половины считаются ПО ЧИСЛУ ОЦЕНОК, а не по календарю: у ученика, которому
 * всё поставили в первую неделю, календарные половины дали бы пустую вторую и
 * «динамику» из ниоткуда. Возвращает null, если в какой-то половине оценок
 * меньше MIN_GRADES_PER_HALF — тогда честнее сказать «рано судить», чем
 * показать перепад от одной случайной отметки.
 */
export function gradeTrend(grades: AnalyticsGrade[]): number | null {
  const vals = grades
    .filter((x) => x.grade5 != null && x.date)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((x) => x.grade5!);
  const half = Math.floor(vals.length / 2);
  if (half < MIN_GRADES_PER_HALF) return null;
  const first = vals.slice(0, half);
  const second = vals.slice(vals.length - half);
  const mean = (arr: number[]) => arr.reduce((p, q) => p + q, 0) / arr.length;
  return mean(second) - mean(first);
}

// ── Группы и предметы ────────────────────────────────────────────────────────

export type GroupStat = {
  groupName: string;
  avgGrade: number | null;
  attendance: number | null;
  gradeCount: number;
  studentCount: number;
};

export function computeGroupStats(
  input: AnalyticsInput,
  studentsByGroup: Map<string, number>,
): GroupStat[] {
  const names = new Set<string>([
    ...input.grades.map((r) => r.groupName),
    ...input.attendance.map((r) => r.groupName),
    ...studentsByGroup.keys(),
  ].filter(Boolean));

  return [...names].map((groupName) => {
    const grades = input.grades.filter((r) => r.groupName === groupName);
    const att = input.attendance.filter((r) => r.groupName === groupName);
    return {
      groupName,
      avgGrade: averageGrade(grades),
      attendance: attendanceRate(att),
      gradeCount: grades.filter((r) => r.grade5 != null).length,
      studentCount: studentsByGroup.get(groupName) ?? 0,
    };
  }).sort((x, y) => (y.avgGrade ?? -1) - (x.avgGrade ?? -1));
}

export type SubjectStat = {
  subject: string;
  avgGrade: number | null;
  attendance: number | null;
  gradeCount: number;
};

export function computeSubjectStats(input: AnalyticsInput): SubjectStat[] {
  const names = new Set<string>([
    ...input.grades.map((r) => r.subject),
    ...input.attendance.map((r) => r.subject),
  ].filter(Boolean));

  return [...names].map((subject) => {
    const grades = input.grades.filter((r) => r.subject === subject);
    const att = input.attendance.filter((r) => r.subject === subject);
    return {
      subject,
      avgGrade: averageGrade(grades),
      attendance: attendanceRate(att),
      gradeCount: grades.filter((r) => r.grade5 != null).length,
    };
  }).sort((x, y) => (x.avgGrade ?? 99) - (y.avgGrade ?? 99));
}

// ── Общая картина ────────────────────────────────────────────────────────────

export type OverallStat = {
  avgGrade: number | null;
  attendance: number | null;
  submitted: number;
  overdue: number;
  gradeCount: number;
};

export function computeOverall(input: AnalyticsInput): OverallStat {
  return {
    avgGrade: averageGrade(input.grades),
    attendance: attendanceRate(input.attendance),
    submitted: input.submitted.length,
    overdue: input.overdue.length,
    gradeCount: input.grades.filter((r) => r.grade5 != null).length,
  };
}

/** Отобрать факты за период [from, to] включительно. Даты — «YYYY-MM-DD»,
 *  сравнение строковое: ISO-даты сравниваются как строки правильно, и это
 *  дешевле разбора в Date на каждой из тысяч строк. */
export function filterByPeriod<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((r) => {
    const d = (r.date ?? "").slice(0, 10);
    return d >= from && d <= to;
  });
}

export { ATTENDANCE_LOW_THRESHOLD };
