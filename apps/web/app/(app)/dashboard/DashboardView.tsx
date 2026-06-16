"use client";

import { Copy } from "lucide-react";
import {
  attendancePercent,
  format,
  formatDate,
  formatTime,
  getDictionary,
  getSubjectStyle,
  nextLesson,
  type Lesson,
  type Group,
  type Homework,
  type HomeworkSubmission,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { factBanner } from "@snr/ui-tokens";
import { EmptyState, GlassCard, MaterialTile, RingProgress, SubjectIcon, useLocale } from "@/components";
import type { Database } from "@snr/core";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Material = Database["public"]["Tables"]["course_materials"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

const FACT = {
  title: "Первый программист в мире — женщина!",
  body: "Ада Лавлейс написала первую программу для аналитической машины Бэббиджа — задолго до появления современных компьютеров.",
};

export function DashboardView({
  student,
  lessons,
  homework,
  submissions,
  attendance,
  groups,
  materials,
}: {
  student: Student;
  lessons: Lesson[];
  homework: Homework[];
  submissions: HomeworkSubmission[];
  attendance: Attendance[];
  groups: Group[];
  materials: Material[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const next = nextLesson(lessons);
  const nextSubject = next ? (groupById.get(next.group_id)?.subject ?? null) : null;
  const submittedIds = new Set(submissions.map((s) => s.homework_id));
  const activeCount = homework.filter((h) => !submittedIds.has(h.id)).length;
  const attPct = attendancePercent(attendance);
  const subjects = Array.from(new Set(groups.map((g) => g.subject)));
  const recent = materials.slice(0, 4);
  const firstName = student.full_name.split(" ")[0] ?? student.full_name;

  const todayLabel = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayCapitalized = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  const activeSuffix = format(d.dashboard.activeTasks, { count: "" }).trim();

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-gray-900 md:text-[34px]">
          {format(d.dashboard.greeting, { name: firstName })}
        </h2>
        <p className="mt-1 text-[15px] font-medium text-gray-500">
          {todayCapitalized}
        </p>
      </div>

      {/* KPI — 3 карточки */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Следующий урок */}
        <GlassCard className="flex flex-col p-5">
          <span className="mb-4 text-[13px] font-semibold text-gray-500">
            {d.dashboard.nextLesson}
          </span>
          {next ? (
            <div className="flex items-center gap-4">
              <SubjectIcon subject={nextSubject} size={64} />
              <div className="flex flex-col">
                <span className="text-[18px] font-bold text-gray-900">
                  {getSubjectStyle(nextSubject).label}
                </span>
                <span className="text-[14px] text-gray-500">
                  {formatTime(next.starts_at)}
                </span>
                {next.room && (
                  <span className="text-[13px] text-gray-400">
                    {d.dashboard.room} {next.room}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-[14px] text-gray-400">
              {d.dashboard.noNextLesson}
            </span>
          )}
        </GlassCard>

        {/* Мои задания */}
        <GlassCard className="flex flex-col p-5">
          <span className="mb-4 text-[13px] font-semibold text-gray-500">
            {d.dashboard.myTasks}
          </span>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-blue-100 shadow-sm">
              <Copy size={22} className="text-blue-600" />
            </div>
            <p className="text-[28px] font-bold leading-none text-gray-900">
              {activeCount}
              <span className="ml-2 text-base font-medium text-gray-500">
                {activeSuffix}
              </span>
            </p>
          </div>
        </GlassCard>

        {/* Прогресс недели */}
        <GlassCard className="flex flex-col p-5">
          <span className="mb-4 text-[13px] font-semibold text-gray-500">
            {d.dashboard.weekProgress}
          </span>
          <div className="flex items-center gap-5">
            <RingProgress value={attPct} size={72} />
            <div>
              <p className="text-[32px] font-bold leading-none text-gray-900">
                {attPct}%
              </p>
              <p className="mt-1 text-[13px] text-gray-400">
                {d.attendance.overall}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Факт дня */}
      <div
        className="relative overflow-hidden rounded-[28px] p-7 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${factBanner.from} 0%, ${factBanner.mid} 50%, ${factBanner.to} 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-12 h-64 w-64 rounded-full bg-white/5" />
        <span className="relative text-xs font-bold uppercase tracking-widest text-blue-200">
          {d.dashboard.factOfDay}
        </span>
        <h3 className="relative mt-2 max-w-[75%] text-[20px] font-bold leading-tight">
          {FACT.title}
        </h3>
        <p className="relative mt-2 max-w-[70%] text-[14px] leading-relaxed text-blue-100/90">
          {FACT.body}
        </p>
      </div>

      {/* Предметы + Материалы */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <h3 className="mb-5 text-[16px] font-bold text-gray-800">
            {d.dashboard.mySubjects}
          </h3>
          {subjects.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {subjects.map((s) => (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-white/40"
                >
                  <SubjectIcon subject={s} size={60} />
                  <span className="w-full truncate text-center text-[13px] font-semibold text-gray-800">
                    {getSubjectStyle(s).label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>{d.common.none}</EmptyState>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="mb-5 text-[16px] font-bold text-gray-800">
            {d.dashboard.recentMaterials}
          </h3>
          {recent.length ? (
            <div className="flex flex-col">
              {recent.map((m) => (
                <MaterialTile
                  key={m.id}
                  title={m.title}
                  type={m.type}
                  meta={formatDate(m.created_at)}
                  layout="row"
                />
              ))}
            </div>
          ) : (
            <EmptyState>{d.common.none}</EmptyState>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
