// Server-side only. Как группа учится по предмету — в виде, пригодном для
// подсказки модели.
//
// ЗАЧЕМ. Учитель создаёт урок для конкретной группы по конкретному предмету.
// Модель об этой группе не знает ничего и выдаёт одинаковый урок и тем, кто
// не тянет, и тем, кому скучно. Здесь собирается короткая справка, которая
// уходит в ТОТ ЖЕ промпт генерации — отдельного вызова модели не появляется,
// то есть подстройка не стоит ни одного лишнего обращения.
//
// СЧИТАЕТ ОБЩИЙ СЛОЙ. Средний балл, посещаемость, признаки риска и динамика —
// функции из @snr/core, те же, что рисуют экран аналитики. Здесь только выбор
// нужного среза и превращение чисел в текст.
//
// ГЛАВНОЕ ПРАВИЛО: МАЛО ДАННЫХ — МОЛЧИМ. У новой группы оценок нет, и
// подстраивать урок не подо что. Тогда справка не строится вовсе, промпт
// остаётся ровно таким, каким был до этой правки, и генерация работает как
// работала. Ни одного «наверное, группа слабая» из воздуха.

import {
  averageGrade, attendanceRate, computeStudentStats,
  LOW_GRADE_BELOW, EXCELLENT_FROM, ATTENDANCE_LOW_THRESHOLD,
} from "@snr/core";
import type { AnalyticsInput } from "@snr/core";
import { collectAnalyticsFacts } from "@/lib/analytics-facts";

/** Сколько оценок нужно у ГРУППЫ, чтобы подстраивать под неё урок.
 *
 *  Порог выше личного (MIN_GRADES_FOR_VERDICT = 5) намеренно: одна оценка на
 *  ученика в группе из десяти — это десять оценок, но ещё не картина по
 *  предмету. Пятнадцать — примерно полтора задания на группу, при которых
 *  средний балл уже перестаёт скакать от одной работы. */
export const MIN_GROUP_GRADES = 15;

export type GroupPerformance = {
  groupName: string;
  subject: string;
  gradeCount: number;
  avgGrade: number | null;
  attendance: number | null;
  studentsTotal: number;
  /** Учеников с признаком «низкие оценки». */
  strugglingCount: number;
  /** Учеников со средним не ниже EXCELLENT_FROM. */
  strongCount: number;
  /** Просроченных работ по предмету во всей группе. */
  overdueCount: number;
  /** Темы (названия уроков), где средний балл заметно ниже общего по группе. */
  weakTopics: Array<{ title: string; avg: number; count: number }>;
  /** Хватает ли данных, чтобы вообще судить. */
  enoughData: boolean;
};

/**
 * Справка по группе и предмету.
 *
 * Возвращает null, если школы/группы нет или данных не хватает — вызывающий
 * в этом случае обязан оставить промпт без изменений.
 */
export async function getGroupPerformance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: { groupName: string; subjectKey: string; todayIso: string },
): Promise<GroupPerformance | null> {
  if (!input.groupName) return null;

  let facts;
  try {
    facts = await collectAnalyticsFacts(db, input.todayIso);
  } catch {
    // Подсказка — надстройка. Если факты не собрались, урок всё равно должен
    // сгенерироваться: молча возвращаем null.
    return null;
  }

  const inScope = <T extends { groupName: string; subject: string }>(rows: T[]) =>
    rows.filter((r) => r.groupName === input.groupName
      && (!input.subjectKey || r.subject === input.subjectKey));

  const sliced: AnalyticsInput = {
    grades: inScope(facts.grades),
    attendance: inScope(facts.attendance),
    submitted: inScope(facts.submitted),
    overdue: inScope(facts.overdue),
  };

  const gradeCount = sliced.grades.filter((g) => g.grade5 != null).length;
  const students = facts.students.filter((s) => s.groupName === input.groupName);

  const stats = computeStudentStats(sliced, students.map((s) => s.id));

  return {
    groupName: input.groupName,
    subject: input.subjectKey,
    gradeCount,
    avgGrade: averageGrade(sliced.grades),
    attendance: attendanceRate(sliced.attendance),
    studentsTotal: students.length,
    strugglingCount: stats.filter((s) => s.risks.includes("low_grades")).length,
    strongCount: stats.filter((s) => !s.tooLittleData && (s.avgGrade ?? 0) >= EXCELLENT_FROM).length,
    overdueCount: sliced.overdue.length,
    weakTopics: findWeakTopics(sliced),
    enoughData: gradeCount >= MIN_GROUP_GRADES,
  };
}

/**
 * Темы, по которым группа просела.
 *
 * Тема здесь — название работы (урока, задания), под которым стоит оценка:
 * своего справочника «тем» у оценок нет, а название работы это ровно то, что
 * учитель узнаёт. Берутся только те, где не меньше пяти оценок и средний ниже
 * общего по предмету на полбалла: иначе в «провалы» попадёт любая работа, где
 * двоим не повезло.
 */
function findWeakTopics(input: AnalyticsInput): Array<{ title: string; avg: number; count: number }> {
  const overall = averageGrade(input.grades);
  if (overall == null) return [];

  const byTitle = new Map<string, number[]>();
  for (const g of input.grades) {
    const title = (g.title ?? "").trim();
    if (!title || g.grade5 == null) continue;
    const cur = byTitle.get(title);
    if (cur) cur.push(g.grade5); else byTitle.set(title, [g.grade5]);
  }

  return [...byTitle.entries()]
    .filter(([, vals]) => vals.length >= 5)
    .map(([title, vals]) => ({ title, avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }))
    .filter((t) => t.avg <= overall - 0.5)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);
}

/**
 * Справка в виде текста для промпта.
 *
 * Возвращает пустую строку, если данных мало — вызывающий подставляет её в
 * промпт как есть, и промпт остаётся прежним. Это и есть «если группа новая,
 * работает как раньше»: не ветка в коде генерации, а пустая строка.
 */
export function groupPerformancePromptSection(p: GroupPerformance | null): string {
  if (!p || !p.enoughData) return "";

  const level = p.avgGrade == null ? "неизвестен"
    : p.avgGrade >= EXCELLENT_FROM ? "высокий"
    : p.avgGrade < LOW_GRADE_BELOW ? "низкий"
    : "средний";

  const lines: string[] = [
    ``,
    `КАК ЭТА ГРУППА УЧИТСЯ ПО ЭТОМУ ПРЕДМЕТУ (реальные данные школы, ${p.gradeCount} оценок):`,
    `- Средний балл группы: ${p.avgGrade?.toFixed(2)} из 5 — уровень ${level}.`,
  ];
  if (p.attendance != null) {
    lines.push(`- Посещаемость: ${p.attendance}%${p.attendance < ATTENDANCE_LOW_THRESHOLD ? " — низкая, часть класса пропускает объяснения" : ""}.`);
  }
  lines.push(`- Учеников в группе: ${p.studentsTotal}. Из них уверенно справляются: ${p.strongCount}, нуждаются в поддержке: ${p.strugglingCount}.`);
  if (p.overdueCount > 0) {
    lines.push(`- Несданных работ по предмету: ${p.overdueCount}.`);
  }
  if (p.weakTopics.length > 0) {
    lines.push(`- Хуже всего далось: ${p.weakTopics.map((t) => `«${t.title}» (${t.avg.toFixed(1)})`).join(", ")}. К этому стоит вернуться.`);
  }

  lines.push(
    ``,
    `КАК ЭТО УЧЕСТЬ В УРОКЕ:`,
    level === "низкий"
      ? `- Группа не тянет: больше объяснения и разбора основ, задания проще и мельче шагами, больше примеров перед самостоятельной работой.`
      : level === "высокий"
      ? `- Группа сильная: не растягивай базу, задания сложнее, добавь дополнительные задачи на подумать для тех, кто закончит раньше.`
      : `- Уровень средний: держи привычный темп, но заложи одно простое задание для отстающих и одно сложное для сильных.`,
  );
  if (p.strugglingCount > 0 && p.strongCount > 0) {
    lines.push(`- В группе есть и сильные, и те, кому трудно: предусмотри задание с разными уровнями сложности, чтобы обе части класса были заняты.`);
  }
  if (p.weakTopics.length > 0) {
    lines.push(`- Начни с короткого повторения того, что далось хуже всего, если это связано с темой урока.`);
  }
  lines.push(
    `- Пиши про поддержку и помощь, а не про слабость учеников. Никаких ярлыков.`,
    ``,
  );

  return lines.join("\n");
}

/** Короткая строка для подсказки к домашнему заданию: там промпт компактный,
 *  и разворачивать в нём целый раздел незачем. */
export function groupPerformanceHomeworkHint(p: GroupPerformance | null): string {
  if (!p || !p.enoughData || p.avgGrade == null) return "";
  const level = p.avgGrade >= EXCELLENT_FROM ? "сильная"
    : p.avgGrade < LOW_GRADE_BELOW ? "слабая"
    : "средняя";
  const tail = level === "слабая"
    ? "Сделай задание проще и с более подробной инструкцией, разбей на мелкие шаги."
    : level === "сильная"
    ? "Сделай задание сложнее обычного и добавь пункт «со звёздочкой» для тех, кто справится быстро."
    : "Держи обычную сложность, но добавь один простой пункт и один посложнее.";
  const weak = p.weakTopics.length > 0
    ? ` Хуже всего группе далось: ${p.weakTopics.map((t) => `«${t.title}»`).join(", ")} — если это связано с темой, включи повторение.`
    : "";
  return `\nУРОВЕНЬ ГРУППЫ (по реальным оценкам, ${p.gradeCount} шт.): средний балл ${p.avgGrade.toFixed(2)} из 5, группа ${level}. ${tail}${weak}`;
}
