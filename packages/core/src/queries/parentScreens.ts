/**
 * Запросы под экраны родителя, общие для веба и мобильного приложения.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ. Эти пять выборок родились 11–12.08.2026 прямо внутри
 * `apps/web/lib/parent-queries.ts` — в момент, когда потребитель был один
 * (веб-родитель). 14.08.2026 те же экраны понадобились мобильному приложению,
 * а тот модуль для него недосягаем: он тянет `next/headers` и серверный
 * supabase-клиент. Копировать запрос во второе место значило бы завести две
 * версии одной правды, которые начнут расходиться с первой же правкой.
 * Поэтому тело переехало сюда, а веб оставил себе ровно то, что у него своё:
 * React-кэш, резолв выбранного ребёнка из cookie и кэш расписания.
 *
 * ЧТО ЗДЕСЬ НЕ ДЕЛАЕТСЯ. Ни одна функция не догадывается, на какого ребёнка
 * смотрит родитель — `studentId` передаётся аргументом ВСЕГДА. Родительский
 * RLS пропускает строки всех детей родителя, и запрос без явного фильтра на
 * втором ребёнке молча вернул бы объединение: не ошибку, а правдоподобную
 * ложь.
 */
import type { Db } from "../supabase/factory";
import type { Book, LessonWithSubject } from "../types";
import { tashkentDayKey } from "../utils/date";
import { getChildCountedGrades, getChildGradesSummary } from "./parent";
import { averageOf } from "../utils/gradeAverage";

// ── Тесты ────────────────────────────────────────────────────────────────────

export type ChildTestItem = {
  id: string;
  title: string;
  subjectName: string | null;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  grade: number | null;
};

/** Сданные ребёнком тесты. RLS сама сужает test_submissions до своих строк,
 *  но studentId передаём явно: у родителя может быть несколько детей, и без
 *  фильтра пришли бы работы всех сразу. */
export async function getChildTests(db: Db, studentId: string): Promise<ChildTestItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("test_submissions")
    .select("id, submitted_at, score, max_score, grade, homework:homework(title, subject:subjects(name))")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    // Название теста живёт в связанном задании; своей колонки у сдачи нет.
    title: (r.homework?.title as string | undefined) ?? "",
    subjectName: (r.homework?.subject?.name as string | undefined) ?? null,
    submittedAt: (r.submitted_at as string | null) ?? null,
    score: (r.score as number | null) ?? null,
    maxScore: (r.max_score as number | null) ?? null,
    grade: (r.grade as number | null) ?? null,
  }));
}

// ── Библиотека ───────────────────────────────────────────────────────────────

export type LibraryBookItem = Book & { isFavorite: boolean };

/** Школьная библиотека. Книги видны родителю по школьной политике на books;
 *  избранное — по конкретному ребёнку, чтобы отметка совпадала с той, что
 *  видит сам ученик. */
export async function getLibraryBooks(db: Db, studentId: string | null): Promise<LibraryBookItem[]> {
  const { data, error } = await db
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const books = (data ?? []) as unknown as Book[];
  if (!studentId) return books.map((b) => ({ ...b, isFavorite: false }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: favs } = await (db as any)
    .from("book_favorites").select("book_id").eq("student_id", studentId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const favSet = new Set(((favs ?? []) as any[]).map((f) => f.book_id as string));
  return books.map((b) => ({ ...b, isFavorite: favSet.has(b.id) }));
}

// ── Профиль учителя ──────────────────────────────────────────────────────────

export type ChildTeacherProfile = {
  id: string;
  fullName: string;
  subjectNames: string[];
  groupNames: string[];
  lessonCount: number;
};

/** Профиль одного учителя ребёнка: предметы, классы и число уроков в
 *  расписании. Всё — из тех же таблиц, что уже читает getGroupSubjectTeachers;
 *  сюда добавлены только группы и счётчик уроков. */
export async function getChildTeacherProfile(
  db: Db,
  studentId: string,
  teacherId: string,
): Promise<ChildTeacherProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const { data: teacher } = await anyDb
    .from("teachers").select("id, full_name").eq("id", teacherId).maybeSingle();
  if (!teacher) return null;

  const { data: groups } = await anyDb
    .from("student_groups").select("group_id, groups(name)").eq("student_id", studentId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupIds = ((groups ?? []) as any[]).map((g) => g.group_id as string);
  if (groupIds.length === 0) {
    return { id: teacher.id, fullName: teacher.full_name, subjectNames: [], groupNames: [], lessonCount: 0 };
  }

  // Отбор ровно тот же, что у getGroupSubjectTeachers (is_active), плюс
  // отсев болванок: иначе список предметов в профиле разошёлся бы со списком
  // на предыдущем экране, который приходит как раз оттуда.
  const { data: subjects } = await anyDb
    .from("subjects").select("id, name, group_id")
    .eq("teacher_id", teacherId).eq("is_active", true).eq("is_stub", false).in("group_id", groupIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subjectRows = (subjects ?? []) as any[];
  const subjectIds = subjectRows.map((s) => s.id as string);

  let lessonCount = 0;
  if (subjectIds.length > 0) {
    const { count } = await anyDb
      .from("lessons").select("id", { count: "exact", head: true })
      .in("subject_id", subjectIds).in("group_id", groupIds);
    lessonCount = count ?? 0;
  }

  const groupNameById = new Map<string, string | undefined>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((groups ?? []) as any[]).map((g) => [g.group_id as string, g.groups?.name as string | undefined]),
  );
  return {
    id: teacher.id as string,
    fullName: teacher.full_name as string,
    subjectNames: [...new Set(subjectRows.map((s) => s.name as string))],
    groupNames: [
      ...new Set(
        subjectRows.map((s) => groupNameById.get(s.group_id as string)).filter(Boolean) as string[],
      ),
    ],
    lessonCount,
  };
}

// ── Дневник ──────────────────────────────────────────────────────────────────

export type DiaryLesson = {
  id: string;
  subjectName: string;
  subjectColor: string | null;
  topic: string | null;
  startsAt: string;
  /** Оценка ребёнка за ЭТОТ урок (lesson_grades) или null. */
  grade: number | null;
  /** Комментарий учителя к оценке — в дневнике он к месту. */
  comment: string | null;
};

export type DiaryDay = {
  /** «YYYY-MM-DD» по Ташкенту. */
  dateKey: string;
  lessons: DiaryLesson[];
  /** Средний балл дня или null, если оценок в этот день не было. */
  average: number | null;
};

export type DiaryWeek = {
  /** Понедельник недели, «YYYY-MM-DD». */
  weekStart: string;
  days: DiaryDay[];
  gradeCount: number;
  average: number | null;
  /** Сдано домашних работ за эту неделю (homework_submissions.submitted_at). */
  homeworkSubmitted: number;
};

/**
 * Неделя дневника: уроки группы ребёнка + его оценки за эти уроки.
 *
 * Отдельной сущности «дневник» в базе нет — это вид поверх готового.
 * Оценки берутся из `lesson_grades` с привязкой к уроку: нормированный
 * `getStudentGrades` для дневника не годится, он теряет lesson_id, а оценка
 * обязана встать напротив своего урока.
 *
 * `lessons` можно передать снаружи — у веба они уже лежат в кэше расписания
 * (unstable_cache), и второй поход к урокам ему не нужен. Мобильное
 * приложение аргумент опускает, и уроки читаются здесь же.
 */
export async function getChildDiaryWeek(
  db: Db,
  studentId: string,
  weekStart: string,
  lessons: LessonWithSubject[],
): Promise<DiaryWeek> {
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);

  const lessonIds = lessons.map((l) => l.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const gradeByLesson = new Map<string, { grade: number; comment: string | null }>();
  if (lessonIds.length > 0) {
    const { data: grades, error } = await anyDb
      .from("lesson_grades")
      .select("lesson_id, grade, comment")
      .eq("student_id", studentId)
      .in("lesson_id", lessonIds);
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of (grades ?? []) as any[]) {
      gradeByLesson.set(g.lesson_id as string, {
        grade: g.grade as number,
        comment: (g.comment as string | null) ?? null,
      });
    }
  }

  // 25.08.2026, заход 2 — ОЦЕНКИ ЗА РАБОТЫ ТОЖЕ ИДУТ В ДНЕВНИК.
  // Среднее дня и недели считалось только по оценкам за урок, и «средний за
  // неделю» в дневнике не сходился со «Средним баллом» на главной у того же
  // ребёнка. Теперь набор один — общий сборщик (getChildCountedGrades).
  //
  // Под уроками работы НЕ показываются: строка дневника — это урок, а работа
  // к уроку не привязана (homework.lesson_id пуст у всех заданий). Они входят
  // только в СРЕДНЕЕ дня, по дате из сборщика.
  const workByDay = new Map<string, number[]>();
  for (const g of await getChildCountedGrades(db, studentId)) {
    if (g.source === "lesson_grades" || !g.date) continue;
    const key = tashkentDayKey(g.date);
    if (key < weekStart || key >= weekEndKey) continue;
    const bucket = workByDay.get(key);
    if (bucket) bucket.push(g.grade5);
    else workByDay.set(key, [g.grade5]);
  }

  // Сдано за неделю — по моменту сдачи, а не по сроку: в шапке недели стоит
  // «сдано работ», то есть сколько ребёнок сделал именно на этой неделе.
  const { count: hwCount } = await anyDb
    .from("homework_submissions")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .gte("submitted_at", `${weekStart}T00:00:00+05:00`)
    .lt("submitted_at", `${weekEndKey}T00:00:00+05:00`);

  const byDay = new Map<string, DiaryLesson[]>();
  for (const l of lessons) {
    const key = tashkentDayKey(l.starts_at);
    const g = gradeByLesson.get(l.id);
    const row: DiaryLesson = {
      id: l.id,
      subjectName: l.subject?.name ?? l.title ?? "—",
      subjectColor: l.subject?.color ?? null,
      topic: l.topic ?? l.title ?? null,
      startsAt: l.starts_at,
      grade: g?.grade ?? null,
      comment: g?.comment ?? null,
    };
    const bucket = byDay.get(key);
    if (bucket) bucket.push(row);
    else byDay.set(key, [row]);
  }

  // Дни, где есть уроки, — плюс дни, где уроков нет, а оценка за работу есть.
  const dayKeys = new Set<string>([...byDay.keys(), ...workByDay.keys()]);

  const days: DiaryDay[] = [...dayKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((dateKey) => {
      const rows = byDay.get(dateKey) ?? [];
      const marks = [
        ...rows.map((r) => r.grade).filter((g): g is number => g != null),
        ...(workByDay.get(dateKey) ?? []),
      ];
      return {
        dateKey,
        lessons: rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        average: averageOf(marks),
      };
    });

  // Счёт и среднее за неделю — по тем же оценкам, что легли в дни. Раньше
  // считалось по l.grade внутри уроков, и работы в число не попадали.
  const allMarks = [
    ...days.flatMap((d) => d.lessons.map((l) => l.grade)).filter((g): g is number => g != null),
    ...[...workByDay.values()].flat(),
  ];

  return {
    weekStart,
    days,
    gradeCount: allMarks.length,
    average: averageOf(allMarks),
    homeworkSubmitted: hwCount ?? 0,
  };
}

// ── Освоение тем ─────────────────────────────────────────────────────────────

export type TopicMasteryItem = {
  topic: string;
  subjectName: string;
  subjectColor: string | null;
  /** Средний балл по теме, 0..5. */
  average: number;
  /** Он же в процентах — как показывает мобильное приложение. */
  pct: number;
  /** Сколько оценок сложилось в этот процент. */
  count: number;
};

/**
 * Освоение тем по ВСЕМ предметам сразу.
 *
 * Тема — это `lessons.topic` реально проведённого урока, а «освоение» —
 * средний балл ребёнка по урокам этой темы, приведённый к процентам. Ровно
 * так же считает уже существующий `getChildSubjectDetail` для одного
 * предмета: формулу не меняем, только снимаем ограничение на один предмет —
 * иначе на экран пришлось бы делать по запросу на предмет.
 *
 * Прохождение ЭТАПОВ урока (`lesson_stage_progress`) здесь ни при чём: это
 * другая величина, и у демо-ребёнка её нет вовсе.
 */
export async function getChildTopicMastery(db: Db, studentId: string): Promise<TopicMasteryItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_grades")
    .select("grade, lesson:lessons!inner(topic, title, subject:subjects(name, color))")
    .eq("student_id", studentId);
  if (error) throw error;

  const map = new Map<
    string,
    { sum: number; count: number; topic: string; subjectName: string; subjectColor: string | null }
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const topic = (r.lesson?.topic as string | null) || (r.lesson?.title as string | null);
    if (!topic) continue;
    const subjectName = (r.lesson?.subject?.name as string | undefined) ?? "—";
    const key = `${subjectName}::${topic}`;
    const cur = map.get(key) ?? {
      sum: 0,
      count: 0,
      topic,
      subjectName,
      subjectColor: (r.lesson?.subject?.color as string | null) ?? null,
    };
    cur.sum += r.grade as number;
    cur.count += 1;
    map.set(key, cur);
  }

  return [...map.values()]
    .map((t) => ({
      topic: t.topic,
      subjectName: t.subjectName,
      subjectColor: t.subjectColor,
      average: t.sum / t.count,
      pct: Math.round((t.sum / t.count / 5) * 100),
      count: t.count,
    }))
    .sort((a, b) => b.pct - a.pct || a.topic.localeCompare(b.topic));
}

// ── Навыки ───────────────────────────────────────────────────────────────────

export type ChildSkill = {
  /** Ключ навыка — по нему берётся название и пояснение из словаря. */
  key: "knowledge" | "thinking" | "communication" | "independence" | "discipline";
  /** 0..100. */
  pct: number;
  /** Из чего сложился именно этот процент — подставляется в подпись. */
  basis: { average?: number | null; subjects?: string[]; attendancePct?: number; submittedPct?: number };
};

export type ChildSkills = {
  skills: ChildSkill[];
  /** Средний уровень по пяти навыкам, 0..100. */
  overall: number;
  /** Предметы с их средним баллом — нижний список экрана. */
  subjects: Array<{ name: string; average: number; count: number; color: string | null }>;
  /** Числа, на которых всё построено, — для подписи внизу экрана. */
  source: {
    gradeCount: number;
    average: number | null;
    attendancePresent: number;
    attendanceTotal: number;
    homeworkSubmitted: number;
    homeworkTotal: number;
  };
};

/**
 * Предметы, которые считаем «точными» и «языковыми».
 *
 * Матчим по названию, а не по ключу: в `subjects` названия свободные, ключа
 * палитры у них нет. Незнакомый предмет не попадает ни в одну группу и влияет
 * только на «Знания».
 */
const EXACT_RE = /матем|алгебр|геометр|физик|информат|програм|робот|хими|matemat|fizika|dastur|robot|math|physic|program|robot|chemis|informat/i;
const HUMANITIES_RE = /язык|литерат|истор|общество|англ|русск|til|adabiyot|tarix|ingliz|rus|langua|literat|histor|social/i;

// 25.08.2026: локальная копия усреднения снесена — среднее одно, в
// utils/gradeAverage. Копий этой функции в продукте было три.

function pctOf5(avg: number | null): number {
  return avg == null ? 0 : Math.round((avg / 5) * 100);
}

/**
 * Уровни навыков ребёнка — считаются ИЗ НАСТОЯЩИХ ДАННЫХ, без единой
 * выдуманной цифры. Формула нарочно простая: её видно на самом экране.
 *
 *  • Знания      = средний балл по всем предметам / 5;
 *  • Мышление    = средний балл по точным предметам / 5;
 *  • Общение     = средний балл по языковым и гуманитарным / 5;
 *  • Самостоятельность = доля сданных работ;
 *  • Дисциплина  = посещаемость.
 *
 * Если у ребёнка нет предметов какой-то группы, соответствующий навык
 * считается по всем предметам сразу — иначе экран показал бы честный, но
 * бессмысленный ноль.
 *
 * Посещаемость и домашние задания приходят готовыми: их читают те же
 * функции, что питают экраны «Посещаемость» и «Домашние задания», и второго
 * запроса за теми же строками здесь не заводится.
 */
export async function getChildSkills(
  db: Db,
  studentId: string,
  input: {
    attendance: { stats: { total: number; present: number } };
    homework: Array<{ submission?: unknown; test_submission?: unknown }>;
  },
): Promise<ChildSkills> {
  const summary = await getChildGradesSummary(db, studentId);

  const subjects = summary.subjects;
  const allAvg = averageOf(subjects.map((s) => s.average));

  const exact = subjects.filter((s) => EXACT_RE.test(s.subjectName));
  const humanities = subjects.filter((s) => HUMANITIES_RE.test(s.subjectName));
  const exactAvg = averageOf(exact.map((s) => s.average)) ?? allAvg;
  const humanitiesAvg = averageOf(humanities.map((s) => s.average)) ?? allAvg;

  const attTotal = input.attendance.stats.total;
  const attPct = attTotal > 0 ? Math.round((input.attendance.stats.present / attTotal) * 100) : 0;

  const hwTotal = input.homework.length;
  const hwSubmitted = input.homework.filter((h) => h.submission != null || h.test_submission != null).length;
  const hwPct = hwTotal > 0 ? Math.round((hwSubmitted / hwTotal) * 100) : 0;

  // Дисциплина и самостоятельность — не про оценки, поэтому это доли, а не
  // баллы, и считаются они по отдельности: дойти до урока и сдать работу —
  // разные вещи, и одно усреднённое число прятало бы, что именно проседает.

  const skills: ChildSkill[] = [
    { key: "knowledge", pct: pctOf5(allAvg), basis: { average: allAvg } },
    { key: "thinking", pct: pctOf5(exactAvg), basis: { average: exactAvg, subjects: exact.map((s) => s.subjectName) } },
    {
      key: "communication",
      pct: pctOf5(humanitiesAvg),
      basis: { average: humanitiesAvg, subjects: humanities.map((s) => s.subjectName) },
    },
    { key: "independence", pct: hwPct, basis: { submittedPct: hwPct } },
    { key: "discipline", pct: attPct, basis: { attendancePct: attPct } },
  ];

  return {
    skills,
    overall: Math.round(skills.reduce((a, b) => a + b.pct, 0) / skills.length),
    subjects: subjects.map((s) => ({
      name: s.subjectName,
      average: s.average,
      count: s.count,
      color: s.color,
    })),
    source: {
      // Счёт по предметам, а не по всем оценкам: у проектов предмета нет, и в
      // разбивку они не попадают (решение заказчика 25.08 — пропускать молча,
      // без «Прочего»). В самом среднем они участвуют.
      gradeCount: subjects.reduce((a, b) => a + b.count, 0),
      average: allAvg,
      attendancePresent: input.attendance.stats.present,
      attendanceTotal: attTotal,
      homeworkSubmitted: hwSubmitted,
      homeworkTotal: hwTotal,
    },
  };
}
