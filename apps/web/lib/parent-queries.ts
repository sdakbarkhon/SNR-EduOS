import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import {
  getChildAttendanceDetail,
  getChildDailyStats,
  getChildDailyStatus,
  getChildDiaryWeek,
  getChildGradesSummary,
  getChildHomeworkDetail,
  getChildLessonDetail,
  getChildMaterials,
  getChildSkills,
  getChildSubjectDetail,
  getChildTeacherProfile,
  getChildTeacherReviews,
  getChildTests,
  getChildTopicMastery,
  getChildWeekActivity,
  getGroupSubjectTeachers,
  getHomeworkWithSubmissions,
  getLibraryBooks,
  getMyNotifications,
  getMySessions,
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
  ChildSkill,
  ChildSkills,
  ChildTeacherProfile,
  ChildTestItem,
  DiaryDay,
  DiaryLesson,
  DiaryWeek,
  LibraryBookItem,
  TopicMasteryItem,
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
  OwnSession,
  ParentAnnouncement,
  StudentGradeItem,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import type { ParentChild } from "@/lib/parent-child";
import { getMySchoolNowMs } from "@/lib/school-time-server";

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

/** «Сейчас» школы родителя в миллисекундах. Z.3, заход 2. */
export async function parentNowMs(): Promise<number> {
  const db = await createClient();
  return getMySchoolNowMs(db);
}

/**
 * «Сегодня» в Ташкенте, YYYY-MM-DD.
 *
 * Z.3, заход 2 — стала асинхронной: время берётся у школы родителя, а её
 * приходится спрашивать у базы. Отсюда `await` у десяти вызывающих страниц.
 * Поход в базу при этом один на запрос: и `createClient()`, и резолвер школы
 * обёрнуты в React `cache()`.
 */
export async function parentToday(): Promise<string> {
  const db = await createClient();
  return new Date((await getMySchoolNowMs(db)) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Понедельник недели, в которую попадает «сегодня», YYYY-MM-DD. */
export async function parentWeekMonday(): Promise<string> {
  const db = await createClient();
  const base = new Date((await getMySchoolNowMs(db)) + 5 * 60 * 60 * 1000);
  const dow = base.getUTCDay(); // 0 = воскресенье
  base.setUTCDate(base.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return base.toISOString().slice(0, 10);
}

/** Текущий месяц, YYYY-MM. */
export async function parentMonth(): Promise<string> {
  return (await parentToday()).slice(0, 7);
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

/**
 * Кэш расписания на неделю — `unstable_cache`, revalidate 60с (задача
 * «убрать 2-3 сек задержку», приоритет 3: «самое результативное для
 * повторных переходов»). Расписание меняется редко (правка учителем/
 * админом), 60 секунд — не заметная пользователю задержка актуальности,
 * зато повторный заход на ту же неделю в течение минуты — 0 сетевых
 * запросов вместо одного.
 *
 * ПОЧЕМУ ОТДЕЛЬНАЯ ФУНКЦИЯ СО СВОИМ КЛИЕНТОМ, А НЕ ПРОСТО ОБЁРНУТЬ
 * childScheduleWeek ЦЕЛИКОМ. Next.js прямо запрещает `cookies()`/`headers()`
 * ВНУТРИ функции, обёрнутой в `unstable_cache` (кидает рантайм-ошибку) — а
 * `createClient()` из `@/lib/supabase/server.ts` читает cookies() под
 * капотом (сессия родителя). Поэтому кэшируемая часть работает через
 * `createAdminClient()` (service-role, без cookies и без RLS) и принимает
 * childId ЯВНЫМ аргументом, а не резолвит его сама.
 *
 * ПОЧЕМУ ЭТО БЕЗОПАСНО, ХОТЯ КЭШ ОБЩИЙ НА ДЕПЛОЙ (не per-request/per-user).
 * `unstable_cache` кладёт результат в Data Cache, видимый ЛЮБОМУ следующему
 * запросу с тем же ключом — а ключ здесь ровно (childId, weekStart) (Next.js
 * сам примешивает АРГУМЕНТЫ функции к ключу поверх статичных keyParts, см.
 * "parent-schedule-week" ниже). Авторизацию «этому родителю МОЖНО видеть
 * именно этот childId» кэш не проверяет — её уже проверил вызывающий код
 * СНАРУЖИ (getSelectedChildId() резолвит childId из cookie, ограниченной
 * RLS-списком детей ИМЕННО этого родителя, до вызова кэша). Раз мы дошли до
 * вызова с конкретным childId, он уже легитимен для текущего запроса.
 * Расписание САМО ПО СЕБЕ не персонализировано под зрителя — оно ОДНО и то
 * же для любого легитимного зрителя этого ребёнка (второй родитель, если
 * появится) — поэтому делить кэш по childId, а не по user_id, корректно:
 * это кэш ДАННЫХ ребёнка, а не кэш ответа конкретному пользователю.
 *
 * Чаты и уведомления — вне этого приёма (задача явно требует «не
 * кешировать»): они персонализированы (непрочитанность у каждого своя) и
 * должны быть свежими на каждый заход, поэтому childHomework/childGrades/
 * реакции-в-реальном-времени этот кэш не трогает вовсе.
 */
const getCachedScheduleWeek = unstable_cache(
  async (childId: string, weekStart: string): Promise<LessonWithSubject[]> => {
    const admin = createAdminClient();
    return getStudentLessonsForWeek(admin, weekStart, childId);
  },
  ["parent-schedule-week"],
  { revalidate: 60 },
);

/** Уроки выбранного ребёнка за неделю. weekStart — понедельник, YYYY-MM-DD
 *  (по умолчанию текущая демо-неделя). */
export const childScheduleWeek = cache(async (weekStart?: string): Promise<LessonWithSubject[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  return getCachedScheduleWeek(childId, weekStart ?? (await parentWeekMonday()));
});

/** Уроки выбранного ребёнка за конкретный день (по умолчанию демо-«сегодня»). */
export const childScheduleDay = cache(async (dateStr?: string): Promise<LessonWithSubject[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getStudentLessonsForDate(db, dateStr ?? (await parentToday()), childId);
});

/** Дата ближайшего учебного дня ПОСЛЕ afterDate — для «Выходной, следующий
 *  урок ...». Сужена группами ребёнка, а не всех детей родителя. */
export const childNextLessonDate = cache(async (afterDate?: string): Promise<string | null> => {
  const childId = await getSelectedChildId();
  if (!childId) return null;
  const db = await createClient();
  return getNextStudentLessonDate(db, afterDate ?? (await parentToday()), childId);
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
  // 25.08.2026, заход 2 — неделя считается от ШКОЛЬНОГО «сейчас».
  // Было Date.now(): у демо-школы время заморожено на 29.07, окно приходилось
  // на пустоту, и «Прогресс за неделю» показывал 0 при 19 оценках внутри той
  // самой недели.
  return getChildWeekActivity(db, childId, await getMySchoolNowMs(db));
});

// ── Посещаемость ─────────────────────────────────────────────────────────────

const EMPTY_ATTENDANCE_STATS = { total: 0, present: 0, excused: 0, unexcused: 0, percentage: 0 };

/** Посещаемость за месяц (YYYY-MM, по умолчанию текущий демо-месяц) в форме,
 *  удобной для календарной сетки. */
export const childAttendance = cache(async (month?: string): Promise<ChildAttendanceDetail> => {
  const resolvedMonth = month ?? (await parentMonth());
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
  return getChildDailyStatus(db, childId, dateStr ?? (await parentToday()));
});

/** Короткая сводка дня для главной: во сколько пришёл, уроков, следующий урок. */
export const childDailyStats = cache(async (dateStr?: string): Promise<ChildDailyStats> => {
  const childId = await getSelectedChildId();
  if (!childId) return { arrivalTime: null, lessonsTotal: 0, lessonsAttended: 0, nextLesson: null };
  const db = await createClient();
  return getChildDailyStats(db, childId, dateStr ?? (await parentToday()));
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

// ── Пять экранов, перенесённых из мобильного приложения (11.08.2026) ──────────
//
// Все пять питаются НАСТОЯЩИМИ данными. Ни фикстур, ни моков: под каждый
// экран проверено запросом, что родитель видит строки под своими правами
// (тесты 4, книги 11, объявления от администрации 5, учителя 5).
// Новых запросов ровно столько, сколько не хватало: объявления от
// администрации — это фильтр над уже существующим parentAnnouncements(),
// учителя — над childSubjectTeachers(), отдельных запросов им не нужно.
//
// 14.08.2026: тела запросов переехали в @snr/core (queries/parentScreens.ts) —
// те же экраны появились в мобильном приложении, а этот модуль ему недоступен
// (next/headers + серверный клиент). Здесь осталось то, что принадлежит вебу:
// React-кэш и резолв выбранного ребёнка.

export type {
  ChildTestItem,
  LibraryBookItem,
  ChildTeacherProfile,
  DiaryLesson,
  DiaryDay,
  DiaryWeek,
  TopicMasteryItem,
  ChildSkill,
  ChildSkills,
};

/** Сданные ребёнком тесты. */
export const childTests = cache(async (): Promise<ChildTestItem[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getChildTests(db, childId);
});

/** Школьная библиотека + отметка «в избранном» у выбранного ребёнка. */
export const libraryBooks = cache(async (): Promise<LibraryBookItem[]> => {
  const [db, childId] = await Promise.all([createClient(), getSelectedChildId()]);
  return getLibraryBooks(db, childId);
});

/** Новости от администрации — те же объявления, что на экране «Объявления»,
 *  но только с admin_id. Отдельного запроса не заводим: getParentAnnouncements
 *  уже возвращает признак isFromAdmin. */
export const parentAdminNews = cache(async (limit = 50): Promise<ParentAnnouncement[]> => {
  const all = await parentAnnouncements(limit);
  return all.filter((a) => a.isFromAdmin);
});

/**
 * Входы в аккаунт родителя.
 *
 * 15.08.2026. Раньше строки брались из public.user_sessions служебным ключом.
 * Это была не та таблица: в ней реестр правила «одна активная сессия», ровно
 * одна строка на аккаунт (UNIQUE (user_id)) — списка устройств из неё не
 * бывает, и родитель всегда видел ровно один пункт. Настоящие входы лежат в
 * auth.sessions; читает их RPC миграции 199 обычным клиентом вошедшего —
 * служебный ключ здесь больше не нужен, а фильтр по пользователю стоит внутри
 * функции и подменить его нечем. Тот же вызов, что и в приложении.
 */
export const parentSessions = cache(async (): Promise<OwnSession[]> => {
  const db = await createClient();
  return getMySessions(db);
});

/** Профиль одного учителя ребёнка: предметы, классы и число уроков. */
export const childTeacherProfile = cache(async (teacherId: string): Promise<ChildTeacherProfile | null> => {
  const childId = await getSelectedChildId();
  if (!childId) return null;
  const db = await createClient();
  return getChildTeacherProfile(db, childId, teacherId);
});

// ── Дневник, освоение тем, помощник (12.08.2026) ─────────────────────────────
//
// Все три питаются уже существующими данными: дневник — уроками группы и
// оценками за урок, темы — теми же оценками, сгруппированными по теме урока,
// помощник — таблицей parent_insights. Своих таблиц не заводится.

/**
 * Неделя дневника: уроки группы ребёнка + его оценки за эти уроки.
 *
 * Уроки берёт тот же `childScheduleWeek`, что и расписание, и передаёт их в
 * общий сборщик готовыми — второго запроса к урокам не заводим и кэш
 * расписания не теряем.
 */
export const childDiaryWeek = cache(async (weekStart: string): Promise<DiaryWeek> => {
  const childId = await getSelectedChildId();
  if (!childId) return { weekStart, days: [], gradeCount: 0, average: null, homeworkSubmitted: 0 };
  const [lessons, db] = await Promise.all([childScheduleWeek(weekStart), createClient()]);
  return getChildDiaryWeek(db, childId, weekStart, lessons);
});

/** Освоение тем ребёнка: тема урока + средний балл по ней в процентах. */
export const childTopicMastery = cache(async (): Promise<TopicMasteryItem[]> => {
  const childId = await getSelectedChildId();
  if (!childId) return [];
  const db = await createClient();
  return getChildTopicMastery(db, childId);
});

export type ParentInsight = {
  summary: string;
  insights: Array<{ title: string; body: string; category: string; sentiment: string }>;
  generatedAt: string;
};

/**
 * Последний разбор помощника по выбранному ребёнку на текущем языке.
 * Только ЧТЕНИЕ: строку в parent_insights кладёт генерация (см.
 * lib/ai/parent-insight.ts), и только служебным ключом — миграция 128 не даёт
 * INSERT никому другому.
 */
export const childInsight = cache(async (locale: string): Promise<ParentInsight | null> => {
  const childId = await getSelectedChildId();
  if (!childId) return null;
  const db = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("parent_insights")
    .select("insight_json, generated_at")
    .eq("child_id", childId)
    .eq("locale", locale)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const j = data.insight_json as { summary?: string; insights?: ParentInsight["insights"] };
  return {
    summary: j?.summary ?? "",
    insights: j?.insights ?? [],
    generatedAt: data.generated_at as string,
  };
});

// ── Навыки ───────────────────────────────────────────────────────────────────

/**
 * Уровни навыков ребёнка. Формула живёт в @snr/core (getChildSkills) — её
 * же показывает подпись внизу экрана; посещаемость и домашние задания
 * подаются уже прочитанными, чтобы не ходить за ними второй раз.
 */
export const childSkills = cache(async (): Promise<ChildSkills> => {
  const childId = await getSelectedChildId();
  const [attendance, homework, db] = await Promise.all([
    childAttendanceRecords(),
    childHomework(),
    createClient(),
  ]);
  if (!childId) {
    return {
      skills: [],
      overall: 0,
      subjects: [],
      source: {
        gradeCount: 0,
        average: null,
        attendancePresent: 0,
        attendanceTotal: 0,
        homeworkSubmitted: 0,
        homeworkTotal: 0,
      },
    };
  }
  return getChildSkills(db, childId, { attendance, homework });
});
