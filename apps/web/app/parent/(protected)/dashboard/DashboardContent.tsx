"use client";

import Link from "next/link";
import { getDictionary } from "@snr/core";
import type { Locale, LessonWithSubject, StudentGradeItem, HomeworkWithSubmission } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SubjectIcon } from "@/components/SubjectIcon";
import { LessonSubjectIcon, FALLBACK_SUBJECT_COLOR } from "@/components/LessonSubjectIcon";
import type { ParentChild } from "@/lib/parent-child";

type Props = {
  parentName: string;
  child: ParentChild | null;
  today: string;
  lessons: LessonWithSubject[];
  weekGrades: StudentGradeItem[];
  pendingHomework: HomeworkWithSubmission[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function lessonStatusLabel(l: LessonWithSubject, t: ReturnType<typeof getDictionary>["parentUi"]): string {
  const now = Date.now();
  const start = new Date(l.starts_at).getTime();
  const end = l.ends_at ? new Date(l.ends_at).getTime() : start + (l.duration_minutes ?? 45) * 60_000;
  if (now >= start && now <= end) return t.lessonNow;
  if (now > end) return t.lessonPast;
  return t.lessonUpcoming;
}

export function DashboardContent({ child, today: _today, lessons, weekGrades, pendingHomework }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;

  if (!child) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-gray-500">{d.parent.noChildren}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {t.todayTitle.replace("{name}", child.full_name)}
        </h1>
        {child.className && <p className="mt-1 text-sm text-gray-500">{child.className}</p>}
      </div>

      {/* Расписание на сегодня */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.scheduleTodayTitle}</h2>
        {lessons.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t.noLessonsToday}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lessons.map((l) => {
              const color = l.subject?.color || FALLBACK_SUBJECT_COLOR;
              const status = lessonStatusLabel(l, t);
              return (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <LessonSubjectIcon icon={l.subject?.icon} color={color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {l.subject?.name ?? l.group.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {formatTime(l.starts_at)} · {l.group.teacher?.full_name ?? "—"}
                      {l.room ? ` · ${l.room}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ color, backgroundColor: `${color}1A` }}
                  >
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Оценки за неделю */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">{t.gradesWeekTitle}</h2>
          <Link href={`/parent/child/${child.id}/grades`} className="text-xs font-semibold text-pink-600 hover:text-pink-700">
            {t.viewAllGrades}
          </Link>
        </div>
        {weekGrades.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t.noGradesWeek}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {weekGrades.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{g.title}</p>
                  <p className="truncate text-xs text-gray-400">{g.subject} · {formatDate(g.date)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-sm font-bold text-pink-700">
                  {g.display}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Невыполненные ДЗ */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">{t.homeworkPendingTitle}</h2>
          <Link href={`/parent/child/${child.id}/homework`} className="text-xs font-semibold text-pink-600 hover:text-pink-700">
            {t.viewAllHomework}
          </Link>
        </div>
        {pendingHomework.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t.allHomeworkDone}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendingHomework.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <SubjectIcon subject={h.group?.subject ?? null} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{h.title}</p>
                  <p className="truncate text-xs text-gray-400">{h.group?.subject}</p>
                </div>
                {h.due_date && (
                  <span className="shrink-0 text-xs font-medium text-gray-400">
                    {t.dueDate.replace("{date}", formatDate(h.due_date))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
