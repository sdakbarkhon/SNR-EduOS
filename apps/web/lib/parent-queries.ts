import { cache } from "react";
import { cookies } from "next/headers";
import {
  getChildAttendanceDetail,
  getChildDailyStats,
  getChildDailyStatus,
  getChildGradesSummary,
  getChildHomeworkDetail,
  getChildLessonDetail,
  getChildMaterials,
  getChildSubjectDetail,
  getChildTeacherReviews,
  getChildWeekActivity,
  getGroupSubjectTeachers,
  getHomeworkWithSubmissions,
  getMyNotifications,
  getMyThreadSummaries,
  getNextStudentLessonDate,
  getParentAnnouncements,
  getStudentAttendance,
  getStudentById,
  getStudentGrades,
  getStudentLessonsForDate,
  getStudentLessonsForWeek,
  getThreadMessages,
  getUnreadCount,
} from "@snr/core";
import type {
  AppNotification,
  ChatMessageRow,
  ChatThreadSummary,
  ChildAttendanceDetail,
  ChildDailyStats,
  ChildDailyStatus,
  ChildGradesSummary,
  ChildHomeworkDetail,
  ChildSubjectDetail,
  ChildTeacherReview,
  ChildWeekActivity,
  GroupSubjectTeacher,
  HomeworkWithSubmission,
  LessonDetail,
  LessonWithSubject,
  MaterialWithGroup,
  ParentAnnouncement,
  StudentGradeItem,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import type { ParentChild } from "@/lib/parent-child";
import { getDemoNowMs } from "@/lib/demo-date";

/**
 * Слой данных для серверных компонентов /parent — тот же приём, что в
 * `lib/cached-queries.ts` (React `cache()` поверх @snr/core), но с двумя
 * добавками, специфичными для родителя:
 *
 *  1. Резолв выбранного ребёнка внутри самой функции — экран не обязан
 *     таскать studentId через пропсы и не может «забыть» его передать.
 *  2. studentId передаётся в core ВСЕГДА. Родительский RLS пропускает строки
 *     ВСЕХ детей родителя, поэтому запрос без studentId на втором ребёнке
 *     молча вернёт объединение (расписание/оценки/ДЗ чужого ребёнка вперемешку)
 *     — не ошибку, а правдоподобную ложь. У текущего демо-родителя ребёнок
 *     один, и такой баг остался бы незамеченным до второго ребёнка.
 *
 * Ошибки НЕ глотаются (в отличие от `safeQuery`): страница сама решает, что
 * показать — ErrorState или пустое состояние. Единственный «мягкий» случай —
 * отсутствие выбранного ребёнка: тогда возвращается пустое значение, потому
 * что этот случай уже отсечён редиректом в `parent/(app)/layout.tsx`.
 *
 * ТОЛЬКО ДЛЯ СЕРВЕРА: модуль тянет `next/headers` (cookies) и серверный
 * supabase-клиент. Импорт из "use client"-компонента ломает сборку — если
 * клиенту нужны имя/ID ребёнка, прокидывайте их пропсами или берите
 * client-safe хелперы из `@/lib/parent-child`.
 */

// ── Дата ─────────────────────────────────────────────────────────────────────
// Демо-«сегодня» заморожено (см. lib/demo-date.ts). Те же вычисления, что в
// app/(app)/lessons/page.tsx — Asia/Tashkent = UTC+5 без переходов на летнее.

/** «Сегодня» демо-сессии в Ташкенте, YYYY-MM-DD. */
export function parentToday(): string {
  return new Date(getDemoNowMs() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Понедельник недели, в которую попадает демо-«сегодня», YYYY-MM-DD. */
export function parentWeekMonday(): string {
  const base = new Date(getDemoNowMs() + 5 * 60 * 60 * 1000);
  const dow = base.getUTCDay(); // 0 = воскресенье
  base.setUTCDate(base.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return base.toISOString().slice(0, 10);
}

/** Текущий месяц демо-сессии, YYYY-MM. */
export function parentMonth(): string {
  return parentToday().slice(0, 7);
}

// ── Выбранный ребёнок ────────────────────────────────────────────────────────

/** Ребёнок, на которого сейчас смотрит родитель: cookie → список детей.
 *  null = родителя/детей нет либо cookie указывает на чужого ребёнка. */
export const getSelectedChild = cache(async (): Promise<ParentChild | null> => {
  const ctx = await getParentContext();
  if (!ctx) return null;
  const jar = await cookies();
  const child = resolveSelectedChild(ctx.children, jar.get(SELECTED_CHILD_COOKIE)?.value ?? null);
  if (!child) {
    console.warn("[parent-queries] выбранный ребёнок не найден — экраны получат пустые данные");
  }
  return child;
});

/** ID выбранного ребёнка (или null). Отдельная функция, чтобы вызывающие
 *  не тянули весь объект ради одного поля. */
export const getSelectedChildId = cache(async (): Promise<string | null> => {
  const child = await getSelectedChild();
  return child?.id ?? null;
});

// ── Расписание / уроки ───────────────────────────────────────────────────────

/** Уроки выбранного ребёнка за неделю. weekStart — понедельник, YYYY-MM-DD
 *  (по умолчанию текущая демо-неделя). */
export const childScheduleWeek = cache(async (weekStart?: string): Promise<LessonWithSubject[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getStudentLessonsForWeek(db, weekStart ?? parentWeekMonday(), childId);
});

/** Уроки выбранного ребёнка за конкретный день (по умолчанию демо-«сегодня»). */
export const childScheduleDay = cache(async (dateStr?: string): Promise<LessonWithSubject[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getStudentLessonsForDate(db, dateStr ?? parentToday(), childId);
});

/** Дата ближайшего учебного дня ПОСЛЕ afterDate — для «Выходной, следующий
 *  урок ...». Сужена группами ребёнка, а не всех детей родителя. */
export const childNextLessonDate = cache(async (afterDate?: string): Promise<string | null> => {
  const childId = await getSelectedChildId();
  if (!childId) return null;
  const db = await createClient();
  return getNextStudentLessonDate(db, afterDate ?? parentToday(), childId);
});

/** Детали одного урока: посещаемость и сдача ДЗ — именно этого ребёнка. */
export const childLessonDetail = cache(async (lessonId: string): Promise<LessonDetail | null> => {
  const childId = await getSelectedChildId();
  if (!childId) return null;
  const db = await createClient();
  return getChildLessonDetail(db, childId, lessonId);
});

// ── Домашние задания ─────────────────────────────────────────────────────────

/** ДЗ групп ребёнка + его собственная сдача (submission/test_submission). */
export const childHomework = cache(async (): Promise<HomeworkWithSubmission[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getHomeworkWithSubmissions(db, childId);
});

/** Одно ДЗ с подробностями сдачи ребёнка. */
export const childHomeworkDetail = cache(
  async (homeworkId: string): Promise<ChildHomeworkDetail | null> => {
    const childId = await getSelectedChildId();
    if (!childId) return null;
    const db = await createClient();
    return getChildHomeworkDetail(db, childId, homeworkId);
  },
);

// ── Оценки ───────────────────────────────────────────────────────────────────

/** Полный журнал оценок ребёнка (6 источников, см. getStudentGrades). */
export const childGrades = cache(async (): Promise<StudentGradeItem[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getStudentGrades(db, childId);
});

const EMPTY_GRADES_SUMMARY: ChildGradesSummary = {
  average: null,
  subjects: [],
  strengths: [],
  growthAreas: [],
};

/** Средний балл + разбивка по предметам + сильные/слабые стороны. */
export const childGradesSummary = cache(async (): Promise<ChildGradesSummary> => {
  const childId = await getSelectedChildId();
  if (!childId) return EMPTY_GRADES_SUMMARY;
  const db = await createClient();
  return getChildGradesSummary(db, childId);
});

/** Один предмет: динамика, темы, оценки. */
export const childSubjectDetail = cache(
  async (subjectId: string): Promise<ChildSubjectDetail | null> => {
    const childId = await getSelectedChildId();
    if (!childId) return null;
    const db = await createClient();
    return getChildSubjectDetail(db, childId, subjectId);
  },
);

/** Текстовые отзывы учителей (lesson_grades.comment). */
export const childTeacherReviews = cache(
  async (opts?: { sinceDays?: number; limit?: number }): Promise<ChildTeacherReview[]> => {
    const childId = await getSelectedChildId();
    if (!childId) return [];
    const db = await createClient();
    return getChildTeacherReviews(db, childId, opts);
  },
);

/** Оценок за последние 7 дней против предыдущих 7 («Прогресс за неделю»). */
export const childWeekActivity = cache(async (): Promise<ChildWeekActivity> => {
  const childId = await getSelectedChildId();
  if (!childId) return { thisWeek: 0, lastWeek: 0, deltaPct: null };
  const db = await createClient();
  return getChildWeekActivity(db, childId);
});

// ── Посещаемость ─────────────────────────────────────────────────────────────

const EMPTY_ATTENDANCE_STATS = { total: 0, present: 0, excused: 0, unexcused: 0, percentage: 0 };

/** Посещаемость за месяц (YYYY-MM, по умолчанию текущий демо-месяц) в форме,
 *  удобной для календарной сетки. */
export const childAttendance = cache(async (month?: string): Promise<ChildAttendanceDetail> => {
  const resolvedMonth = month ?? parentMonth();
  const childId = await getSelectedChildId();
  if (!childId) return { month: resolvedMonth, stats: { ...EMPTY_ATTENDANCE_STATS }, days: [] };
  const db = await createClient();
  return getChildAttendanceDetail(db, childId, resolvedMonth);
});

type StudentAttendanceResult = Awaited<ReturnType<typeof getStudentAttendance>>;

/** Плоский список отметок посещаемости + статистика (без привязки к месяцу). */
export const childAttendanceRecords = cache(
  async (filters?: { subject?: string; month?: string }): Promise<StudentAttendanceResult> => {
    const childId = await getSelectedChildId();
    if (!childId) return { records: [], stats: { ...EMPTY_ATTENDANCE_STATS } };
    const db = await createClient();
    return getStudentAttendance(db, filters, childId);
  },
);

// ── День ребёнка ─────────────────────────────────────────────────────────────

const EMPTY_DAILY_STATUS: Omit<ChildDailyStatus, "lessons" | "gradesToday"> = {
  isDayOff: true,
  totalLessons: 0,
  attendedCount: 0,
  missedCount: 0,
  homeworkAssignedToday: 0,
};

/** «Статус дня»: таймлайн уроков с посещаемостью + итоги дня. */
export const childDailyStatus = cache(async (dateStr?: string): Promise<ChildDailyStatus> => {
  const childId = await getSelectedChildId();
  if (!childId) return { ...EMPTY_DAILY_STATUS, lessons: [], gradesToday: [] };
  const db = await createClient();
  return getChildDailyStatus(db, childId, dateStr ?? parentToday());
});

/** Короткая сводка дня для главной: во сколько пришёл, уроков, следующий урок. */
export const childDailyStats = cache(async (dateStr?: string): Promise<ChildDailyStats> => {
  const childId = await getSelectedChildId();
  if (!childId) return { arrivalTime: null, lessonsTotal: 0, lessonsAttended: 0, nextLesson: null };
  const db = await createClient();
  return getChildDailyStats(db, childId, dateStr ?? parentToday());
});

// ── Профиль ребёнка ──────────────────────────────────────────────────────────

type StudentProfile = Awaited<ReturnType<typeof getStudentById>>;

/** Карточка ребёнка: ФИО, ДР, аватар, куратор, группы. */
export const childProfile = cache(async (): Promise<StudentProfile | null> => {
  const childId = await getSelectedChildId();
  if (!childId) return null;
  const db = await createClient();
  return getStudentById(db, childId);
});

/** Предметы класса ребёнка с учителями. */
export const childSubjectTeachers = cache(async (): Promise<GroupSubjectTeacher[]> => {
  const child = await getSelectedChild();
  if (!child) return [];
  const db = await createClient();
  const profile = await getStudentById(db, child.id);
  const groupId = profile.student_groups.find((sg) => sg.groups)?.groups?.id ?? null;
  if (!groupId) return [];
  return getGroupSubjectTeachers(db, groupId);
});

// ── Материалы ────────────────────────────────────────────────────────────────

/** Учебные материалы групп ребёнка (getMaterials без studentId отдал бы
 *  объединение по всем детям родителя). */
export const childMaterials = cache(async (): Promise<MaterialWithGroup[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getChildMaterials(db, childId);
});

// ── Объявления / уведомления / чаты (скоуп родителя, не ребёнка) ─────────────

export const parentAnnouncements = cache(async (limit = 100): Promise<ParentAnnouncement[]> => {
  const db = await createClient();
  return getParentAnnouncements(db, limit);
});

export const parentNotifications = cache(async (limit = 50): Promise<AppNotification[]> => {
  const db = await createClient();
  return getMyNotifications(db, limit);
});

export const parentUnreadCount = cache(async (): Promise<number> => {
  const db = await createClient();
  return getUnreadCount(db);
});

export const parentThreads = cache(async (): Promise<ChatThreadSummary[]> => {
  const db = await createClient();
  return getMyThreadSummaries(db);
});

export const parentThreadMessages = cache(async (threadId: string): Promise<ChatMessageRow[]> => {
  const db = await createClient();
  return getThreadMessages(db, threadId);
});
