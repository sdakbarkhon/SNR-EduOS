"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  getDictionary,
  getSubjectStyle,
  homeworkCategory,
  type HomeworkWithSubmission,
  type Locale,
} from "@snr/core";
import { cn } from "@/lib/cn";
import { SubjectIcon, useLocale, useToast } from "@/components";

const TZ_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent (UTC+5), фиксировано как в остальных queries/страницах
const LOCALE_MAP: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };

function tk(dt: Date): Date {
  return new Date(dt.getTime() + TZ_MS);
}
function dateKey(dt: Date): string {
  return tk(dt).toISOString().slice(0, 10);
}
function mondayOf(dt: Date): Date {
  const t = tk(dt);
  const dow = t.getUTCDay(); // 0 = вс
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(t);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
}

export function HomeworkCalendarCard({ rows, now }: { rows: HomeworkWithSubmission[]; now: Date }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const showToast = useToast();
  const localeStr = LOCALE_MAP[locale] ?? "ru-RU";

  const todayKey = dateKey(now);
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const weekDays = useMemo(() => {
    const monday = mondayOf(now);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday);
      dt.setUTCDate(dt.getUTCDate() + i);
      return {
        key: dt.toISOString().slice(0, 10),
        n: dt.getUTCDate(),
        w: dt.toLocaleDateString(localeStr, { weekday: "short", timeZone: "UTC" }),
      };
    });
  }, [now, localeStr]);

  const dueTodayCount = useMemo(
    () => rows.filter((r) => r.due_date && dateKey(new Date(r.due_date)) === todayKey).length,
    [rows, todayKey],
  );

  const upcoming = useMemo(
    () =>
      rows
        .filter((r) => r.due_date && homeworkCategory(r, r.submission) !== "completed")
        .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))
        .slice(0, 3),
    [rows],
  );

  return (
    <div className="rounded-[22px] border border-slate-100 bg-white shadow-[0_2px_12px_rgba(24,20,50,0.04)] p-5">
      <h3 className="text-lg font-extrabold text-slate-800">{d.homework.calendarTitle}</h3>

      <div className="grid grid-cols-7 gap-0.5 mt-4">
        {weekDays.map((day) => (
          <div key={day.key} className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 capitalize">{day.w}</span>
            <button
              type="button"
              onClick={() => setSelectedKey(day.key)}
              className={cn(
                "w-8 h-8 rounded-[11px] text-sm font-bold transition-colors",
                selectedKey === day.key ? "text-white" : "text-slate-600 hover:bg-violet-50",
              )}
              style={selectedKey === day.key ? { background: "linear-gradient(135deg,#8E72F8,#6C4EE6)" } : undefined}
            >
              {day.n}
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 mt-4">
        <span className="text-[13.5px] font-extrabold text-slate-700">{d.homework.dueToday}</span>
        <span className="text-xs font-bold text-slate-400">
          {d.homework.dueTodayCount.replace("{n}", String(dueTodayCount))}
        </span>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-400 font-medium text-center py-6">{d.homework.calendarEmpty}</p>
      ) : (
        <div className="mt-1">
          {upcoming.map((hw, i) => {
            const style = getSubjectStyle(hw.group.subject);
            const dateLabel = new Date(hw.due_date as string).toLocaleDateString(localeStr, {
              day: "numeric",
              month: "long",
              timeZone: "Asia/Tashkent",
            });
            return (
              <div key={hw.id} className={cn("flex items-center gap-3 py-3", i > 0 && "border-t border-slate-100")}>
                <SubjectIcon subject={hw.group.subject} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold text-slate-800 truncate">{hw.title}</div>
                  <div className="text-xs font-semibold text-slate-400 truncate">{style.label}</div>
                </div>
                <span className="text-xs font-extrabold whitespace-nowrap" style={{ color: style.color }}>
                  {d.homework.dueUntil.replace("{date}", dateLabel)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => showToast(d.auth.comingSoon)}
        className="w-full flex items-center justify-between pt-3.5 mt-1 border-t border-slate-100 text-violet-600 font-extrabold text-sm hover:text-violet-700 transition-colors"
      >
        {d.homework.calendarLink}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
