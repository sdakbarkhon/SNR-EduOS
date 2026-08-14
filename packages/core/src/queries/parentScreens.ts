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

  const days: DiaryDay[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, rows]) => {
      const marks = rows.map((r) => r.grade).filter((g): g is number => g != null);
      return {
        dateKey,
        lessons: rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        average: marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null,
      };
    });

  const allMarks = days
    .flatMap((d) => d.lessons.map((l) => l.grade))
    .filter((g): g is number => g != null);

  return {
    weekStart,
    days,
    gradeCount: allMarks.length,
    average: allMarks.length > 0 ? allMarks.reduce((a, b) => a + b, 0) / allMarks.length : null,
    homeworkSubmitted: hwCount ?? 0,
  };
}
