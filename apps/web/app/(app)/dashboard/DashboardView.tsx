"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Flame, Lock,
  Sparkles, ArrowRight, FileText, Folder, UserPlus, Calendar,
  Check, Award, Trophy, Target, type LucideIcon,
} from "lucide-react";
import {
  formatTime,
  getDictionary,
  type Lesson,
  type Group,
  type Homework,
  type HomeworkSubmission,
  type TestSubmission,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components";
import { useToast } from "@/components/Toast";
import { getClassLabel } from "@/lib/student-class-label";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { Modal } from "@/components/Modal";
import type { Database } from "@snr/core";

type Student = Database["public"]["Tables"]["students"]["Row"];
type SubjectRow = { id: string; name: string; group_id: string; icon: string; color: string; is_active: boolean };

const LOCALE_MAP: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };
// Заглушка серии успехов — реальной таблицы стриков нет (Iter5 P9)
const STREAK_DAYS = 7;
const STREAK_DONE = [true, true, true, true, true, true, false];

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

// Школа работает в Ташкенте (UTC+5) — "сегодня" должно быть посчитано по
// этому фиксированному смещению, а не по локальному часовому поясу
// сервера/браузера (тот может отличаться от Ташкента). Тот же паттерн, что
// уже используется в LessonsView.tsx (dateKey()) для той же задачи.
const TZ_MS = 5 * 60 * 60 * 1000;
function tashkentDateKey(d: Date): string {
  return new Date(d.getTime() + TZ_MS).toISOString().slice(0, 10);
}

export function DashboardView({
  student,
  lessons,
  homework,
  submissions,
  testSubmissions,
  groups,
}: {
  student: Student;
  lessons: Lesson[];
  homework: Homework[];
  submissions: HomeworkSubmission[];
  testSubmissions: TestSubmission[];
  groups: Group[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.dashboard;
  const db = createClient();
  const showToast = useToast();
  const localeStr = LOCALE_MAP[locale] ?? "ru-RU";

  // Subjects loaded from the subjects table, realtime-synced (Iter4 P2).
  const [mySubjects, setMySubjects] = useState<SubjectRow[]>([]);
  const stableLoadSubjects = useRef<() => Promise<void>>(undefined);

  // null until client mounts — avoids a UTC(server)/local(client) hydration mismatch
  // when deciding which lessons count as "today" (project-wide rule, see memory).
  // Recomputed every 30s (same pattern as /lessons — LessonsView.tsx) so the
  // "Сейчас"/"Скоро" badges don't get stuck once a lesson's ends_at passes.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    stableLoadSubjects.current = async () => {
      if (!groups.length) return;
      const groupIds = groups.map((g) => g.id);
      const { data } = await (db as any).from("subjects").select("id, name, group_id, icon, color, is_active").in("group_id", groupIds);
      if (data) setMySubjects(data as SubjectRow[]);
    };
    stableLoadSubjects.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  useEffect(() => {
    const channel = db
      .channel("dashboard-subjects")
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, () => {
        stableLoadSubjects.current?.();
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI fact of the day (unchanged logic from before the redesign).
  const [aiFactText, setAiFactText] = useState<string | null>(null);
  const [factLoading, setFactLoading] = useState(true);

  async function loadFact() {
    setFactLoading(true);
    try {
      const res = await fetch("/api/daily-fact");
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text) setAiFactText(data.text);
    } catch {
      // noop — fact stays null, banner hides
    }
    setFactLoading(false);
  }

  useEffect(() => { loadFact(); }, []);

  // There's no "full description" backing the fact of the day — searching it
  // on Google is the fallback the spec allows when no extended content exists.
  function learnMore() {
    if (!aiFactText) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(aiFactText)}`, "_blank", "noopener,noreferrer");
  }

  const submittedIds = new Set(submissions.map((s) => s.homework_id));
  const activeHomeworkCount = homework.filter((h) => !submittedIds.has(h.id)).length;
  const firstName = student.full_name.split(" ")[0] ?? student.full_name;
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const classLabel = getClassLabel(groups);
  const greeting = t.greetings[dayOfYear(now ?? new Date()) % t.greetings.length];

  // Today's lessons — only computed client-side once `now` is set, for the
  // same hydration-safety reason above.
  const todayLessonsAll = now
    ? lessons
        .filter((l) => tashkentDateKey(new Date(l.starts_at)) === tashkentDateKey(now))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    : [];
  // Уроки сегодня видны ВЕСЬ день — раньше прошедшие вычищались отсюда, из-за
  // чего после последнего урока дня виджет считал день "пустым" и показывал
  // "Нет уроков" вместо реального расписания. "Нет уроков" теперь — это
  // ТОЛЬКО пустой todayLessonsAll (см. проверку ниже), не "все прошли".
  const MAX_TODAY_WIDGET = 3;
  const lastLessonOfDay = todayLessonsAll.length > 0 ? todayLessonsAll[todayLessonsAll.length - 1] : null;
  const dayIsOver = now !== null && !!lastLessonOfDay?.ends_at && now > new Date(lastLessonOfDay.ends_at);
  // Пока день не закончился — виджет показывает первые MAX_TODAY_WIDGET по
  // времени (как раньше). Когда день закончился — хвост списка, чтобы
  // "замёрзший" на "Сейчас" последний урок дня точно попал в кадр (см.
  // isNow ниже), а не был бы обрезан, если уроков в дне больше лимита виджета.
  const todayLessons = dayIsOver
    ? todayLessonsAll.slice(-MAX_TODAY_WIDGET)
    : todayLessonsAll.slice(0, MAX_TODAY_WIDGET);
  const hasMoreToday = todayLessonsAll.length > MAX_TODAY_WIDGET;
  const subjectById = new Map(mySubjects.map((s) => [s.id, s]));

  // "Мой прогресс" (ЧАСТЬ 2) — доля СДАННЫХ заданий от ВЫДАННЫХ, за всё время
  // (не за неделю: свежий полный ресет заданий делает "неделю" произвольным
  // срезом). Источник: homework (выдано) + homework_submissions/
  // test_submissions (сдано, RLS уже сужает обе выборки до своих же строк).
  // Внешние сервисы (codesandbox/wokwi/geogebra/desmos/learningapps и т.д.)
  // никогда не сдаются по дизайну — попадают в "выдано", никогда в "сдано",
  // 100% для них недостижимо, и это ожидаемо (не 0%/деление на ноль).
  const homeworkById = new Map(homework.map((h) => [h.id, h]));
  const submittedHomeworkIds = new Set<string>([
    ...submissions.map((s) => s.homework_id),
    ...testSubmissions.map((ts) => ts.homework_id),
  ]);
  const totalAssignedCount = homework.length;
  const totalSubmittedCount = homework.filter((h) => submittedHomeworkIds.has(h.id)).length;
  const overallPercent = totalAssignedCount > 0 ? Math.round((totalSubmittedCount / totalAssignedCount) * 100) : 0;

  // Per-subject: то же самое (сдано/выдано), в разрезе subject_id — раньше
  // считалось от completed/total LESSONS, к заданиям отношения не имело.
  // Заодно средний балл по предмету (grade — дискретная 2..5 шкала что у
  // homework_submissions, что у test_submissions) для модалки ниже.
  // Stub subjects (is_active=false) никогда не имеют заданий — полный
  // каталог (активные+заглушки) отдельно показан ниже в "Предметы класса".
  const subjectsWithProgress = mySubjects.filter((sub) => sub.is_active).map((sub) => {
    const subjectHomework = homework.filter((h) => h.subject_id === sub.id);
    const total = subjectHomework.length;
    const done = subjectHomework.filter((h) => submittedHomeworkIds.has(h.id)).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const grades: number[] = [];
    for (const s of submissions) {
      if (s.grade != null && homeworkById.get(s.homework_id)?.subject_id === sub.id) grades.push(s.grade);
    }
    for (const ts of testSubmissions) {
      if (ts.grade != null && homeworkById.get(ts.homework_id)?.subject_id === sub.id) grades.push(ts.grade);
    }
    const avgGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
    return { ...sub, percent, total, done, avgGrade };
  });

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((fallback, i) => {
    const label = now
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1 + i)
          .toLocaleDateString(localeStr, { weekday: "short" })
      : fallback;
    return { label, done: STREAK_DONE[i] };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-6 xl:flex-row">
        {/* MAIN COLUMN */}
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Приветствие */}
          <div>
            <h1 className="flex items-center gap-2.5 text-[28px] font-black tracking-tight text-[#2A2A45] md:text-[36px]">
              {t.greeting.replace("{name}", firstName)}
              <span className="animate-wave inline-block text-[28px] md:text-[32px]">👋</span>
            </h1>
            <p className="mt-1.5 text-[15px] font-semibold text-[#9A9AB5] md:text-base">{greeting}</p>
          </div>

          {/* HERO ROW: Факт дня + Серия успехов */}
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Факт дня */}
            <div
              className="relative flex min-h-[240px] flex-[1.08] flex-col rounded-[24px] p-6 text-white shadow-[0_16px_34px_rgba(107,74,230,0.3)]"
              style={{ background: "linear-gradient(135deg,#8E74F2 0%,#6A48E4 100%)" }}
            >
              {/* Decorative layer, clipped to the rounded card corners and
                  painted BEHIND the text/button below — previously these
                  elements came after the text in DOM order and could paint
                  on top of long fact text, on top of overflow-hidden on the
                  card itself clipping wrapped lines outright (root cause of
                  the mid-word cut-off bug). */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
                <span className="animate-twinkle absolute left-1/2 top-[70px] text-[15px] text-white/90">✦</span>
                <span className="animate-twinkle absolute left-[44%] top-[140px] text-[11px] text-white/75" style={{ animationDelay: ".9s" }}>✦</span>
                <span className="animate-twinkle absolute right-11 top-9 text-[13px] text-[#FFE08A]" style={{ animationDelay: ".4s" }}>✦</span>
                <div className="animate-float-medium absolute bottom-6 right-16 text-[56px] leading-none">🌸</div>
                <div className="animate-float-slow absolute -bottom-1 right-3 text-[100px] leading-none drop-shadow-[0_12px_18px_rgba(50,20,100,0.32)]">🐝</div>
              </div>

              <div className="relative flex items-center gap-2 text-[16px] font-extrabold">
                <Sparkles className="h-[22px] w-[22px] text-[#FFE08A]" /> {t.factOfDay}
              </div>

              {factLoading ? (
                <div className="relative mt-4 flex gap-1.5 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
                </div>
              ) : (
                <p className="relative mt-4 max-w-[85%] break-words text-[21px] font-extrabold leading-snug">{aiFactText}</p>
              )}

              {!factLoading && aiFactText && (
                <button
                  onClick={learnMore}
                  className="relative mt-auto flex items-center gap-2 self-start rounded-2xl bg-white px-5 py-3 text-[15px] font-extrabold text-[#6A48E4] shadow-[0_8px_18px_rgba(40,20,90,0.2)] transition hover:-translate-y-0.5"
                >
                  {t.learnMore} <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Серия успехов — заглушка (Iter5 P9) */}
            <div className="relative flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-[24px] bg-white p-[22px] shadow-[0_10px_30px_rgba(93,80,150,0.06)]">
              <div className="flex items-center gap-2 text-[16px] font-extrabold text-[#2A2A45]">
                <Flame className="h-[22px] w-[22px] text-[#FF7A2E]" /> {t.streakTitle}
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span className="text-[42px] font-black leading-none text-[#7C5CFF]">{STREAK_DAYS}</span>
                <span className="text-[15px] font-bold text-[#8E8EA9]">{t.streakDays.replace("{n}", "").trim()}</span>
              </div>
              <div className="relative mt-1 flex-1">
                <svg viewBox="0 0 320 120" width="100%" height="100%" preserveAspectRatio="none" className="block overflow-visible">
                  <defs>
                    <linearGradient id="streakLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#FFD36E" />
                      <stop offset="1" stopColor="#FF9F2E" />
                    </linearGradient>
                    <linearGradient id="streakFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="rgba(255,183,62,.26)" />
                      <stop offset="1" stopColor="rgba(255,183,62,0)" />
                    </linearGradient>
                  </defs>
                  <path d="M4,104 C46,100 66,92 96,88 C132,83 152,68 192,58 C230,49 252,28 306,14 L306,118 L4,118 Z" fill="url(#streakFill)" stroke="none" />
                  <path d="M4,104 C46,100 66,92 96,88 C132,83 152,68 192,58 C230,49 252,28 306,14" fill="none" stroke="url(#streakLine)" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="mt-2 flex justify-between">
                {weekDays.map((wd, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-black"
                      style={{
                        background: wd.done ? "#4E86F7" : "#EEF0F6",
                        color: wd.done ? "#fff" : "#B7B7CE",
                        boxShadow: wd.done ? "0 4px 10px rgba(78,134,247,.3)" : undefined,
                      }}
                    >
                      {wd.done ? <Check className="h-3.5 w-3.5" /> : "·"}
                    </div>
                    <span className="text-[11px] font-bold capitalize text-[#9A9AB5]">{wd.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Быстрые действия */}
          <div>
            <h2 className="mb-3.5 text-lg font-extrabold text-[#2A2A45]">{t.quickActions}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <QuickAction icon={<FileText />} bg="#FFF3DE" iconBg="#FFB020" iconColor="#fff" label={t.qaHomework} badge={activeHomeworkCount} href="/homework" />
              <QuickAction icon={<Folder />} bg="#E9F1FF" iconBg="#4E86F7" iconColor="#fff" label={t.qaFiles} href="/knowledge-base" />
              <QuickAction icon={<UserPlus />} bg="#FCE9F2" iconBg="#F368A8" iconColor="#fff" label={t.qaTeacher} onClick={() => showToast(d.auth.comingSoon)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Мой прогресс — кликабельно, открывает модалку с разбивкой по предметам (ЧАСТЬ 2) */}
            <button
              type="button"
              onClick={() => setProgressModalOpen(true)}
              className="relative overflow-hidden rounded-[24px] bg-white p-[22px] text-left shadow-[0_10px_30px_rgba(93,80,150,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(93,80,150,0.12)]"
            >
              <h3 className="text-[18px] font-extrabold text-[#2A2A45]">{t.myProgress}</h3>
              <div className="mt-3.5 flex items-center gap-2">
                <div
                  className="relative flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-full shadow-[0_10px_22px_rgba(124,92,255,0.18)]"
                  style={{ background: `conic-gradient(#7C5CFF 0% ${overallPercent}%, #ECE7FB ${overallPercent}% 100%)` }}
                >
                  <div className="flex h-[110px] w-[110px] flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-[30px] font-black leading-none text-[#2A2A45]">
                      {overallPercent}<span className="text-[18px]">%</span>
                    </span>
                    <span className="mt-1 text-center text-[11px] font-bold leading-tight text-[#9A9AB5]">{t.progressAllTime}</span>
                  </div>
                </div>
                <div className="relative flex min-h-[140px] flex-1 items-center justify-center">
                  <span className="animate-twinkle absolute left-6 top-[18px] text-xs text-[#FFC93C]">✦</span>
                  <span className="animate-twinkle absolute bottom-[22px] right-3.5 text-[11px] text-[#B79BFF]" style={{ animationDelay: ".7s" }}>✦</span>
                  <div className="animate-float-medium text-[78px] leading-none drop-shadow-[0_10px_14px_rgba(90,60,180,0.24)]">🧑‍🚀</div>
                </div>
              </div>
            </button>

            {/* Мои предметы */}
            <div className="rounded-[24px] bg-white p-[22px] shadow-[0_10px_30px_rgba(93,80,150,0.06)]">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-extrabold text-[#2A2A45]">{t.mySubjects}</h3>
                <Link href="/lessons" className="text-[13px] font-extrabold text-[#7C5CFF] hover:underline">
                  {t.seeAll}
                </Link>
              </div>
              {subjectsWithProgress.length ? (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {subjectsWithProgress.slice(0, 3).map((sub) => {
                    const SubIcon = LUCIDE_ICONS[sub.icon] ?? BookOpen;
                    return (
                      <div key={sub.id} className="flex flex-col gap-2 rounded-[18px] p-3.5" style={{ backgroundColor: `${sub.color}1F` }}>
                        <div className="flex h-11 w-11 items-center justify-center rounded-[13px]" style={{ background: sub.color, boxShadow: `0 6px 14px ${sub.color}66` }}>
                          <SubIcon className="h-5 w-5 text-white" />
                        </div>
                        <p className="min-h-[31px] truncate text-[13px] font-extrabold leading-tight text-[#2A2A45]">{sub.name}</p>
                        <p className="text-[20px] font-black" style={{ color: sub.color }}>{sub.percent}%</p>
                        <div className="h-2 overflow-hidden rounded-full bg-white/60">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${sub.percent}%`, background: sub.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[#9A9AB5]">{d.common.none}</p>
              )}
            </div>
          </div>

          {/* Предметы класса — полный каталог (БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 2.4).
              Рабочие предметы кликабельны (ведут в /lessons); заглушки
              (is_active=false) показаны затемнёнными с иконкой замка — клик
              просто показывает тост "Скоро появится", без перехода. */}
          {mySubjects.length > 0 && (
            <div className="rounded-[24px] bg-white p-[22px] shadow-[0_10px_30px_rgba(93,80,150,0.06)]">
              <h3 className="text-[18px] font-extrabold text-[#2A2A45]">{t.classSubjectsTitle}</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {[...mySubjects].sort((a, b) => Number(b.is_active) - Number(a.is_active)).map((sub) => {
                  const SubIcon = LUCIDE_ICONS[sub.icon] ?? BookOpen;
                  const card = (
                    <div
                      className={`flex h-full flex-col items-center gap-2 rounded-[16px] p-3 text-center transition ${sub.is_active ? "hover:-translate-y-0.5" : "opacity-60"}`}
                      style={{ backgroundColor: sub.is_active ? `${sub.color}1F` : "#F1F1F5" }}
                    >
                      <div
                        className="relative flex h-10 w-10 items-center justify-center rounded-[12px]"
                        style={{ background: sub.is_active ? sub.color : "#B7B7CE" }}
                      >
                        <SubIcon className="h-5 w-5 text-white" />
                        {!sub.is_active && (
                          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow">
                            <Lock className="h-2.5 w-2.5 text-[#9A9AB5]" />
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-[12px] font-bold leading-tight text-[#2A2A45]">{sub.name}</p>
                    </div>
                  );
                  return sub.is_active ? (
                    <Link key={sub.id} href="/lessons">{card}</Link>
                  ) : (
                    <button key={sub.id} type="button" onClick={() => showToast(t.subjectComingSoon)} className="text-left">
                      {card}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Баннер целей — заглушка (Iter5 P9) */}
          <div
            className="relative flex min-h-[104px] items-center gap-5 overflow-hidden rounded-[22px] px-7 py-[22px]"
            style={{ background: "linear-gradient(100deg,#FFE7D6 0%,#FFDCE6 52%,#F4E1FF 100%)" }}
          >
            <span className="animate-twinkle absolute right-[150px] top-[26px] text-[13px] text-[#C89BE8]">✦</span>
            <span className="animate-twinkle absolute right-11 top-4 text-[11px] text-[#F49AC0]" style={{ animationDelay: ".6s" }}>✦</span>
            <div className="flex-1">
              <div className="text-[20px] font-black text-[#3A2B45]">{t.goalsTitle}</div>
              <div className="mt-1.5 text-sm font-semibold text-[#8A7A90]">{t.goalsSubtitle}</div>
            </div>
            <button
              onClick={() => showToast(d.auth.comingSoon)}
              className="mr-[76px] flex items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-[22px] py-3.5 text-[15px] font-extrabold text-[#E5772E] shadow-[0_8px_18px_rgba(200,120,60,0.2)] transition hover:-translate-y-0.5"
            >
              {t.viewGoals} <ArrowRight className="h-4 w-4" />
            </button>
            <Trophy className="animate-float-slow pointer-events-none absolute -bottom-2 right-[22px] h-[72px] w-[72px] text-[#E5772E] drop-shadow-[0_8px_12px_rgba(180,110,40,0.3)]" />
          </div>
        </main>

        {/* RIGHT RAIL */}
        <aside className="flex w-full shrink-0 flex-col gap-6 xl:w-[340px]">
          {/* Расписание на сегодня */}
          <div className="rounded-[24px] bg-white p-[22px] shadow-[0_10px_30px_rgba(93,80,150,0.06)]">
            <div className="mb-2 flex items-center gap-2 text-[18px] font-extrabold text-[#2A2A45]">
              <Calendar className="h-[22px] w-[22px] text-[#7C5CFF]" /> {t.todaySchedule}
            </div>
            <div className="flex flex-col gap-0.5">
              {todayLessons.map((lesson) => {
                const sub = lesson.subject_id ? subjectById.get(lesson.subject_id) : undefined;
                const SubIcon = sub ? (LUCIDE_ICONS[sub.icon] ?? BookOpen) : BookOpen;
                const start = new Date(lesson.starts_at);
                const end = lesson.ends_at ? new Date(lesson.ends_at) : null;
                // Замирание: последний урок дня, когда его время уже прошло
                // (день окончен), продолжает считаться "Сейчас" — до полуночи
                // Ташкента, когда крон реально закроет день. Остальные
                // прошедшие уроки — нейтральные, без метки.
                const isFrozenLast = dayIsOver && lastLessonOfDay?.id === lesson.id;
                const isNow = isFrozenLast || (now !== null && now >= start && (!end || now <= end));
                const isNext = !isNow && now !== null && start.getTime() - now.getTime() > 0
                  && start.getTime() - now.getTime() < 15 * 60 * 1000;
                const isPast = !isNow && !isNext && now !== null && !!end && now > end;
                const tileColor = sub?.color ?? "#94A3B8";
                return (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    className="flex items-center gap-2.5 rounded-2xl p-2.5 transition hover:bg-[#F7F5FF]"
                    style={{ background: isNow ? "#F4F0FF" : undefined }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tileColor }} />
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
                      style={{ background: tileColor, boxShadow: `0 6px 14px ${tileColor}5C` }}
                    >
                      <SubIcon className="h-[22px] w-[22px] text-white" />
                    </div>
                    <div className="flex w-[46px] shrink-0 flex-col leading-tight">
                      <span className="text-sm font-extrabold text-[#2A2A45]">{formatTime(lesson.starts_at)}</span>
                      {end && <span className="text-xs font-semibold text-[#B4B4C8]">{formatTime(lesson.ends_at as string)}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-extrabold text-[#2A2A45]">
                        {sub?.name ?? lesson.title ?? lesson.topic ?? "—"}
                      </p>
                      {lesson.room && <p className="text-[12.5px] font-semibold text-[#9A9AB5]">{t.room} {lesson.room}</p>}
                    </div>
                    {isNow ? (
                      <span className="shrink-0 rounded-[10px] bg-[#F1EDFF] px-2.5 py-1 text-[11px] font-extrabold text-[#7C5CFF]">
                        {t.now}
                      </span>
                    ) : isNext ? (
                      <span className="shrink-0 rounded-[10px] bg-[#FFF3DE] px-2.5 py-1 text-[11px] font-extrabold text-[#FFB020]">
                        {t.next}
                      </span>
                    ) : null}
                  </Link>
                );
              })}

              {now && todayLessonsAll.length === 0 && (
                <p className="py-8 text-center text-sm text-[#9A9AB5]">{t.noLessonsToday}</p>
              )}
            </div>

            {hasMoreToday && (
              <Link
                href="/lessons"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-[#F1EDFF] py-3 text-sm font-extrabold text-[#7C5CFF] transition hover:bg-[#E6DDFF]"
              >
                {t.fullSchedule} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* Мои достижения — заглушка, реальной таблицы нет */}
          <div className="rounded-[24px] bg-white p-[22px] shadow-[0_10px_30px_rgba(93,80,150,0.06)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-extrabold text-[#2A2A45]">{t.myAchievements}</h3>
              <button onClick={() => showToast(d.auth.comingSoon)} className="text-[13px] font-extrabold text-[#7C5CFF] hover:underline">
                {t.allAchievements}
              </button>
            </div>

            <div className="mt-[18px] flex justify-between gap-2">
              <AchievementBadge icon={Award} label="Исследователь" gradient="linear-gradient(150deg,#FFD24A,#FF9F2E)" shadow="rgba(255,159,46,.34)" isNew />
              <AchievementBadge icon={Trophy} label="Трудолюбивый" gradient="linear-gradient(150deg,#9C6BFF,#7A4DF6)" shadow="rgba(124,77,246,.34)" isNew />
              <AchievementBadge icon={Target} label="Целеустремлённый" gradient="linear-gradient(150deg,#38D6BE,#20B6C6)" shadow="rgba(45,190,198,.34)" />
            </div>

            <div className="mt-5 flex items-center gap-3.5">
              <div className="flex-1">
                <div className="mb-2 flex justify-between text-xs font-bold text-[#8E8EA9]">
                  <span>{t.nextReward}</span>
                  <span className="font-extrabold text-[#2A2A45]">150 XP</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F1EDF3]">
                  <div className="h-full rounded-full" style={{ width: "62%", background: "linear-gradient(90deg,#FF9F6E,#FF7EA8)" }} />
                </div>
              </div>
              <span className="animate-float-medium text-[40px] leading-none">🎁</span>
            </div>
          </div>
        </aside>
      </div>

      {/* "Мой прогресс" — разбивка по предметам (ЧАСТЬ 2), только просмотр */}
      <Modal open={progressModalOpen} onClose={() => setProgressModalOpen(false)} title={t.myProgress}>
        <div className="flex flex-col gap-3">
          {subjectsWithProgress.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#9A9AB5]">{t.progressModalEmpty}</p>
          ) : (
            subjectsWithProgress.map((sub) => {
              const SubIcon = LUCIDE_ICONS[sub.icon] ?? BookOpen;
              return (
                <div key={sub.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: sub.color }}>
                    <SubIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[#2A2A45]">{sub.name}</p>
                    <p className="text-xs font-semibold text-[#9A9AB5]">
                      {sub.total > 0
                        ? t.progressModalDoneOf.replace("{done}", String(sub.done)).replace("{total}", String(sub.total))
                        : t.progressModalEmpty}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black" style={{ color: sub.color }}>{sub.percent}%</p>
                    <p className="text-[11px] font-semibold text-[#9A9AB5]">
                      {t.progressModalAvgGrade}: {sub.avgGrade != null ? sub.avgGrade.toFixed(1) : t.progressModalNoGrades}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div className="mt-1 flex items-center justify-between rounded-2xl bg-[#F1EDFF] px-4 py-3.5">
            <span className="text-sm font-extrabold text-[#2A2A45]">{t.progressModalTotal}</span>
            <span className="text-lg font-black text-[#7C5CFF]">
              {t.progressModalDoneOf.replace("{done}", String(totalSubmittedCount)).replace("{total}", String(totalAssignedCount))} · {overallPercent}%
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function QuickAction({
  icon, bg, iconBg, iconColor, label, badge, href, onClick, textLight,
}: {
  icon: React.ReactNode;
  bg: string;
  iconBg: string;
  iconColor: string;
  label: string;
  badge?: number;
  href?: string;
  onClick?: () => void;
  textLight?: boolean;
}) {
  const content = (
    <div
      className="relative flex min-h-[150px] cursor-pointer flex-col justify-between rounded-[20px] p-[18px] shadow-[0_8px_20px_rgba(93,80,150,0.05)] transition hover:-translate-y-1"
      style={{ background: bg }}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl" style={{ background: iconBg }}>
        <div className="h-[26px] w-[26px]" style={{ color: iconColor }}>{icon}</div>
      </div>
      <p className="text-[15px] font-extrabold" style={{ color: textLight ? "#fff" : "#2A2A45" }}>{label}</p>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-3.5 top-3.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#F5455C] px-1.5 text-xs font-extrabold text-white">
          {badge}
        </span>
      )}
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} type="button" className="w-full text-left">{content}</button>;
  }
  return <Link href={href ?? "#"}>{content}</Link>;
}

function AchievementBadge({
  icon: Icon, label, gradient, shadow, isNew,
}: {
  icon: LucideIcon;
  label: string;
  gradient: string;
  shadow: string;
  isNew?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 transition hover:-translate-y-1">
      <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] text-white" style={{ background: gradient, boxShadow: `0 10px 20px ${shadow}` }}>
        <Icon className="h-8 w-8" />
        {isNew && (
          <span className="absolute -right-1.5 -top-1.5 rounded-lg bg-[#F5455C] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">
            NEW
          </span>
        )}
      </div>
      <span className="text-center text-xs font-bold text-[#6F6F8C]">{label}</span>
    </div>
  );
}
