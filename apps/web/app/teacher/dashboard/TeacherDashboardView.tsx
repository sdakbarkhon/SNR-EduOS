"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar, CheckCircle2, Clock, FileText, Megaphone, Users,
} from "lucide-react";
import {
  findCurrentLesson, findNextLesson, getDictionary, getSubjectConfig,
  formatTime, formatDate, formatRoom, subjectDisplay,
  pendingReviewCount, checkedCountOf, isFileSubmissionPending,
} from "@snr/core";
import type { Locale, LessonStatus } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useSchoolNow } from "@/components/SchoolTimeProvider";
import { Avatar } from "@/components/Avatar";
import { LessonSubjectIcon } from "@/components/LessonSubjectIcon";
import { ErrorState } from "@/components/ErrorState";
import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/cn";

// ── Types ────────────────────────────────────────────────────────────────────

type TodayLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: LessonStatus;
  room: string | null;
  topic: string | null;
  group: { id: string; name: string; subject: string };
  // 26.08.2026: настоящий предмет урока. group.subject — заглушка 'programming'
  // у всех групп, из-за неё урок английского подписывался программированием.
  subject: { name: string; icon: string | null; color: string | null } | null;
};

type Submission = {
  id: string;
  homework_id: string;
  status: string;
  submitted_at: string;
  homework: { title: string } | null;
  student: { full_name: string } | null;
};

interface Props {
  teacher: { id: string; full_name: string | null } | null;
  groups: Array<{
    id: string; name: string; subject: string;
    enrolled: Array<{ student_id: string }>;
  }>;
  homework: Array<{
    id: string; title: string; due_date: string | null;
    // 26.08.2026: оценки в выборке — признак проверки теперь один на продукт
    // (utils/reviewQueue), а он смотрит на оценку, а не на статус.
    submissions: Array<{ status: string; grade: number | null }>;
    test_subs: Array<{ id: string; grade: number | null }>;
    teacher_id: string | null;
  }>;
  todayLessons: TodayLesson[];
  recentSubmissions: Submission[];
  todayLessonsError?: boolean;
  announcements: Array<{
    id: string; title: string; body: string; created_at: string;
    is_pinned: boolean; authorName: string | null; isFromAdmin: boolean; groupName: string | null;
  }>;
}

// ── Расписание дня ────────────────────────────────────────────────────────────

// 24.08.2026 — ПОЧАСОВОЙ ШКАЛЫ БОЛЬШЕ НЕТ.
// Блок рисовал сетку с 08:00 до 17:00 фиксированной высоты (520 px). Уроки
// занимали четыре строки сверху, под ними стояло шесть часов пустоты — больше
// половины блока. Теперь список карточек: блок ровно по содержимому, пустого
// места нет вовсе.

/** Прошёл, идёт или ещё будет — по школьному времени. */
type LessonPhase = "past" | "now" | "future";

/**
 * Фаза урока.
 *
 * Тот же счёт, что у плитки «Уроков сегодня» наверху: прошедшим считается
 * завершённый ИЛИ тот, у кого время окончания позади. Два места на одном
 * экране обязаны считать одинаково, иначе плитка скажет «2 из 6», а в списке
 * выделенными окажутся три.
 *
 * Метки времени сравниваются напрямую, без разбора на часы: getHours() читает
 * ЛОКАЛЬНЫЕ часы браузера, и у учителя не из Ташкента граница уезжала бы.
 * Именно этим болела старая шкала — она ставила уроки по часам браузера.
 */
function lessonPhase(l: TodayLesson, now: Date): LessonPhase {
  if (l.status === "in_progress") return "now";
  if (l.status === "completed" || new Date(l.ends_at).getTime() <= now.getTime()) return "past";
  return "future";
}

type LessonTone = { card: string; time: string; title: string; sub: string; chip: string };

// Решение 21.07 (отключение авто-режима, миграция 143): scheduled-урок, чьё
// время уже прошло, но который не начали вручную, НЕ помечается «Пропущен» —
// статуса и красного цвета для него нет нигде. Поэтому у прошедших только
// приглушение, а подпись «Завершён» получает лишь по-настоящему завершённый.
const LESSON_TONE: Record<LessonPhase, LessonTone> = {
  now: {
    card: "border-amber-300 bg-amber-50 shadow-md shadow-amber-500/10",
    time: "text-amber-900",
    title: "text-amber-950",
    sub: "text-amber-700",
    chip: "border-amber-200 bg-white/70 text-amber-800",
  },
  past: {
    card: "border-slate-100 bg-slate-50/60",
    time: "text-slate-400",
    title: "text-slate-500",
    sub: "text-slate-400",
    chip: "border-slate-200 bg-white/60 text-slate-400",
  },
  future: {
    card: "border-white bg-white shadow-sm",
    time: "text-slate-700",
    title: "text-slate-900",
    sub: "text-slate-500",
    chip: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// nowMs is null on server + first client render → returns "" to avoid hydration mismatch.
function timeAgo(iso: string, nowMs: number | null): string {
  if (nowMs === null) return "";
  const m = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function pluralMin(n: number) {
  if (n === 1) return "минуту";
  if (n >= 2 && n <= 4) return "минуты";
  return "минут";
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, highlight, compact,
}: {
  title: string; value: string | number; icon: typeof Users; highlight?: boolean;
  /** Значение — фраза, а не число: печатаем мельче, иначе «No lessons today»
   *  не влезает в карточку ни на одном языке кроме русского. */
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "relative flex h-32 flex-col justify-between overflow-hidden rounded-[24px] p-5",
      highlight
        ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30"
        : "border border-white bg-white/70 shadow-sm backdrop-blur-xl",
    )}>
      <div className="relative z-10">
        <div className={cn("mb-1 text-sm", highlight ? "opacity-80" : "text-slate-500")}>{title}</div>
        <div className={cn(
          "font-bold",
          compact ? "text-lg leading-snug" : "text-3xl",
          highlight ? "text-white" : "text-slate-800",
        )}>{value}</div>
      </div>
      {highlight && (
        <div className="absolute -bottom-2 -right-2 opacity-20"><Icon className="h-20 w-20" /></div>
      )}
    </div>
  );
}

// ── Hero block ────────────────────────────────────────────────────────────────

type HeroMode = "in_progress" | "soon" | "next" | "none";

function findHeroLesson(
  lessons: TodayLesson[],
  now: Date,
): { lesson: TodayLesson; mode: Exclude<HeroMode, "none"> } | null {
  // Единый общий хелпер (единообразно с ученическими/родительскими
  // экранами): "Сейчас" — status='in_progress', "Далее" — первый
  // scheduled по времени, включая просроченные-но-не-начатые (учитель
  // ещё не нажал "Начать" вручную — решение 21.07, авто-старта по
  // времени больше нет). Раньше здесь была локальная копия этой же
  // "поймать просроченный урок" логики (findNextLesson изначально не
  // умел её — исправлено после адверсариальной проверки, поэтому теперь
  // безопасно унифицировано). "soon" vs "next" — чисто презентационный
  // порог (в пределах часа), не отдельный источник истины.
  const active = findCurrentLesson(lessons);
  if (active) return { lesson: active, mode: "in_progress" };
  const next = findNextLesson(lessons);
  if (!next) return null;
  const diff = new Date(next.starts_at).getTime() - now.getTime();
  return { lesson: next, mode: diff <= 3_600_000 ? "soon" : "next" };
}

function HeroBlock({ lessons, now }: { lessons: TodayLesson[]; now: Date | null }) {
  if (!now || lessons.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[20px] border border-slate-200/60 bg-white/60 py-8 text-slate-400 backdrop-blur-xl">
        <Calendar className="h-6 w-6" />
        <span className="text-[15px] font-medium">Сегодня уроков нет. Расписание свободно.</span>
      </div>
    );
  }

  const hit = findHeroLesson(lessons, now);
  if (!hit) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[20px] border border-slate-200/60 bg-white/60 py-8 text-slate-400 backdrop-blur-xl">
        <Calendar className="h-6 w-6" />
        <span className="text-[15px] font-medium">Уроки на сегодня завершены.</span>
      </div>
    );
  }

  const { lesson, mode } = hit;
  const subjectLabel = subjectDisplay(lesson.subject?.name);

  // "soon" ловит и уже просроченные-но-не-начатые уроки (см. findHeroLesson)
  // — tillMin отрицателен в этом случае, что нельзя показывать как обратный
  // отсчёт ("До начала: -12 мин" выглядело бы как раз тем самым "просрочено",
  // которого решение 21.07 просит избегать). isOverdue разводит эти два
  // случая на разные, оба нейтральные (без красного/тревожного) варианты.
  const tillMin = mode === "soon"
    ? Math.ceil((new Date(lesson.starts_at).getTime() - now.getTime()) / 60000)
    : null;
  const isOverdueUnstarted = mode === "soon" && tillMin !== null && tillMin <= 0;

  const containerCls =
    mode === "in_progress" ? "bg-emerald-50/60 border-emerald-200" :
    mode === "soon" && !isOverdueUnstarted ? "bg-yellow-50/60 border-yellow-200" :
                             "bg-white/60 border-slate-200/60";

  const badge = mode === "in_progress" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[12px] font-bold text-white">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      Идёт сейчас
    </span>
  ) : mode === "soon" && !isOverdueUnstarted ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-3 py-1 text-[12px] font-bold text-yellow-900">
      <Clock className="h-3 w-3" /> Скоро начнётся
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-600">
      <Calendar className="h-3 w-3" /> Запланировано
    </span>
  );

  // Часть 3 (решение 21.07): счётчик "Длится N мин" убран полностью — в
  // in_progress статус меняется только вручную, elapsed-с-момента-старта
  // не показываем нигде в статусной строке/hero. "До начала" остаётся
  // только для реально предстоящих уроков (isOverdueUnstarted их исключает).
  const counter = tillMin != null && !isOverdueUnstarted ? (
    <span className="text-[13px] font-medium text-yellow-700">
      До начала: {tillMin} {pluralMin(tillMin)}
    </span>
  ) : null;

  const ctaCls = mode === "in_progress" ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className={cn("flex items-center justify-between gap-6 rounded-[20px] border p-6 backdrop-blur-xl", containerCls)}>
      <div className="flex items-start gap-4">
        <LessonSubjectIcon icon={lesson.subject?.icon} color={lesson.subject?.color} size={56} />
        <div>
          {badge}
          <h2 className="mt-2 text-[20px] font-bold text-slate-800">
            {lesson.topic ?? `${subjectLabel} — ${lesson.group.name}`}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
            <span>{subjectLabel}</span>
            <span>·</span>
            <span>{lesson.group.name}</span>
            {lesson.room && <><span>·</span><span>Кабинет {lesson.room}</span></>}
            <span>·</span>
            <span>{formatTime(lesson.starts_at)} — {formatTime(lesson.ends_at)}</span>
          </div>
          {counter && <div className="mt-2">{counter}</div>}
        </div>
      </div>
      <Link
        href={`/teacher/lessons/${lesson.id}`}
        className={cn("shrink-0 rounded-xl px-5 py-3 text-[14px] font-bold text-white shadow-md transition-all hover:shadow-lg", ctaCls)}
      >
        Открыть урок
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeacherDashboardView({
  teacher, groups, homework, todayLessons, recentSubmissions,
  todayLessonsError = false, announcements,
}: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  // Z.3, заход 3 — «сейчас» из школы; у замороженной таймер не заводится.
  const now = useSchoolNow(60_000);

  // KPI
  const studentIds = new Set<string>();
  groups.forEach((g) => g.enrolled?.forEach((e) => studentIds.add(e.student_id)));
  const totalStudents = studentIds.size;
  // 26.08.2026. Было: только файловые сдачи со статусом submitted, тесты не
  // смотрели вовсе — дашборд показывал 0, а пончик на «Заданиях» про те же
  // работы показывал 120. Теперь оба зовут одно правило (utils/reviewQueue).
  const pendingCount = pendingReviewCount(homework);
  const checkedCount = homework.reduce((acc, h) => acc + checkedCountOf(h), 0);
  // 24.08.2026 — вместо «Среднего балла».
  //
  // ПОЧЕМУ УБРАЛИ СРЕДНИЙ БАЛЛ. Плитка усредняла оценки за уроки СРАЗУ ПО ВСЕМ
  // группам учителя. У третьего класса и у десятого разные предметы, разные
  // темы и разные шкалы строгости — одно число по ним не значит ничего. На
  // живых данных это видно прямо: у Камилы Юсуповой 3-А даёт 3.87, 7-А — 3.91,
  // 10-А — 3.77, а плитка показывала 3.84, то есть число, которого нет ни у
  // одной группы. Разбивка по группам осталась там, где ей место, — «Мои классы».
  //
  // КАК СЧИТАЕМ ТЕПЕРЬ. Уроки сегодняшнего дня уже пришли на дашборд
  // (getTeacherTodayLessons, границы суток по Ташкенту от ШКОЛЬНОГО «сейчас»),
  // второго запроса не нужно. Урок считается прошедшим, если он завершён ИЛИ
  // время его окончания уже позади.
  //
  // ВРЕМЯ БЕРЁМ ШКОЛЬНОЕ, А НЕ БРАУЗЕРНОЕ. `now` приходит из useSchoolNow: у
  // замороженной школы это неподвижная точка (29.07.2026, 10:15 по Ташкенту),
  // у настоящей — живые часы. Сравниваем метки времени напрямую, без getHours():
  // разбор по местным часам браузера сдвинул бы границу у любого, кто сидит не
  // в Ташкенте. Той же ошибкой, кстати, болеет полоса расписания ниже.
  const lessonsToday = todayLessons.length;
  const lessonsPassed = todayLessons.filter(
    (l) => l.status === "completed" || new Date(l.ends_at).getTime() <= now.getTime(),
  ).length;

  // Right column data
  // Список под плиткой — по тому же признаку, что и её число: иначе «0 на
  // проверке» соседствовало бы с непустым списком работ на проверку.
  const pendingReview = recentSubmissions.filter(isFileSubmissionPending).slice(0, 5);
  const allActivity = recentSubmissions.slice(0, 5);

  return (
    <PageContainer className="space-y-6 pb-6">

      {/* Greeting */}
      <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
        {d.dashboard.greeting.replace("{name}", teacher?.full_name ?? d.teacher.role)}
      </h1>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="Всего учеников" value={totalStudents} icon={Users} />
        <KpiCard title="На проверке"    value={pendingCount}   icon={FileText}     highlight />
        <KpiCard title="Проверено"      value={checkedCount}   icon={CheckCircle2} />
        <KpiCard
          title={d.teacher.todayLessons}
          value={lessonsToday === 0
            ? d.teacher.noLessons
            : d.teacher.kpiLessonsDone
                .replace("{done}", String(lessonsPassed))
                .replace("{total}", String(lessonsToday))}
          compact={lessonsToday === 0}
          icon={Calendar}
        />
      </div>

      {/* Hero: current / next lesson */}
      <HeroBlock lessons={todayLessons} now={now} />

      {/* Two-column layout */}
      <div className="grid grid-cols-12 gap-6">

        {/* СЛЕВА: расписание дня списком (8 из 12 колонок) */}
        <section className="col-span-8 rounded-[24px] border border-white bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">{d.teacher.scheduleTitle}</h2>
            <span className="text-[13px] text-slate-400">
              {formatDate(now.toISOString(), locale)}
            </span>
          </div>

          {todayLessonsError ? (
            <div className="py-8"><ErrorState>{d.common.error}</ErrorState></div>
          ) : todayLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Calendar className="h-9 w-9 text-slate-300" />
              <p className="text-[15px] font-semibold text-slate-500">{d.teacher.scheduleFreeDay}</p>
              <p className="text-[13px] text-slate-400">{d.teacher.scheduleFreeDayHint}</p>
            </div>
          ) : (
            /* Список карточек сверху вниз. Высота — по содержимому: ни сетки
               часов слева, ни пустого хвоста под последним уроком.
               Ограничение сверху нужно ровно одному случаю — куратору, который
               видит все восемнадцать уроков дня: без него левая колонка
               уезжала бы на километр ниже правой. При четырёх уроках высота
               остаётся по четырём карточкам, прокрутки не появляется. */
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {todayLessons.map((lesson) => {
                const phase = lessonPhase(lesson, now);
                const tone = LESSON_TONE[phase];
                const room = formatRoom(lesson.room, d.teacher.lessonRoom);
                return (
                  <Link
                    key={lesson.id}
                    href={`/teacher/lessons/${lesson.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-shadow hover:shadow-md",
                      tone.card,
                    )}
                  >
                    {/* Время — одной строкой, моноширинными цифрами, чтобы
                        колонка не прыгала от урока к уроку. */}
                    <span className={cn("w-[104px] shrink-0 text-[13px] font-bold tabular-nums", tone.time)}>
                      {formatTime(lesson.starts_at)} – {formatTime(lesson.ends_at)}
                    </span>

                    <span className={cn("shrink-0", phase === "past" && "opacity-50")}>
                      <LessonSubjectIcon icon={lesson.subject?.icon} color={lesson.subject?.color} size={34} />
                    </span>

                    {/* Предмет и тема делят остаток строки и обрезаются. Оба
                        обязаны уметь сжиматься: экраны учителя начинаются с
                        768, и при жёсткой ширине предмета строка переполнялась
                        бы на узком краю — «Программирование» само по себе
                        занимает треть доступного места. */}
                    <span className={cn("min-w-0 flex-1 truncate text-[14px] font-bold", tone.title)}>
                      {subjectDisplay(lesson.subject?.name)}
                    </span>
                    {lesson.topic && (
                      <span className={cn("min-w-0 flex-[2] truncate text-[13px]", tone.sub)}>
                        {lesson.topic}
                      </span>
                    )}

                    <span className={cn("shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-semibold", tone.chip)}>
                      {lesson.group.name}
                    </span>

                    {/* Кабинет обычным текстом, а не плашкой: две плашки подряд
                        не влезают в 768, а прятать кабинет нельзя — он часть
                        сведений об уроке. */}
                    {room && (
                      <span className={cn("shrink-0 text-[11px] font-medium", tone.sub)}>
                        {room}
                      </span>
                    )}

                    {phase === "now" ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                        {d.teacher.lessonNow}
                      </span>
                    ) : lesson.status === "completed" ? (
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                        {d.teacher.lessonDone}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT: 3 blocks (4 cols) */}
        <div className="col-span-4 flex flex-col gap-4">

          {/* Block 1 — Pending review */}
          <section className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-800">Работы на проверку</h2>
              {pendingCount > 0 && (
                <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </div>
            {pendingReview.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-[13px] font-medium text-emerald-600">Все работы проверены!</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pendingReview.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/teacher/homework/${sub.homework_id}`}
                      className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-slate-50"
                    >
                      <Avatar name={sub.student?.full_name ?? "?"} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-800">
                          {sub.student?.full_name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {sub.homework?.title}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {timeAgo(sub.submitted_at, now?.getTime() ?? null)}
                      </span>
                    </Link>
                  ))}
                </div>
                {pendingCount > 5 && (
                  <Link
                    href="/teacher/homework"
                    className="mt-3 block text-center text-[12px] font-semibold text-blue-600 hover:underline"
                  >
                    Все работы →
                  </Link>
                )}
              </>
            )}
          </section>

          {/* Block 2 — Announcements (Большой фикс, Блок 4): школьные
              (админ, scope='all_my_groups') + классные для своих групп
              (scope='group', is_my_teacher_group) — миграция 158. */}
          <section className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-3 text-[15px] font-bold text-slate-800">Объявления</h2>
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center text-slate-400">
                <Megaphone className="h-7 w-7 opacity-40" />
                <p className="text-[12px] leading-relaxed">
                  Пока нет объявлений
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcements.map((a) => (
                  <div key={a.id} className="rounded-xl p-2.5 transition-colors hover:bg-slate-50">
                    <div className="flex items-start gap-2">
                      <Megaphone className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", a.is_pinned ? "text-amber-500" : "text-slate-300")} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-800">{a.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">{a.body}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span>{a.isFromAdmin ? "Школа" : a.groupName ?? a.authorName ?? ""}</span>
                          <span>·</span>
                          <span>{timeAgo(a.created_at, now?.getTime() ?? null)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Block 3 — Activity feed */}
          <section className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-4 text-[15px] font-bold text-slate-800">{d.teacher.recentActivity}</h2>
            {allActivity.length === 0 ? (
              <p className="text-[12px] text-slate-400">{d.teacher.noActivity}</p>
            ) : (
              <div className="space-y-3">
                {allActivity.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/teacher/homework/${sub.homework_id}`}
                    className="flex items-start gap-2"
                  >
                    <Avatar name={sub.student?.full_name ?? "?"} size={28} />
                    <div className="min-w-0 text-[12px] leading-snug">
                      <span className="font-semibold text-slate-800">{sub.student?.full_name}</span>{" "}
                      <span className="text-slate-500">
                        {sub.status === "graded" ? "получил(а) оценку за" : "сдал(а)"}
                      </span>{" "}
                      <span className="font-medium italic text-blue-600">
                        «{sub.homework?.title}»
                      </span>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {timeAgo(sub.submitted_at, now?.getTime() ?? null)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </PageContainer>
  );
}
