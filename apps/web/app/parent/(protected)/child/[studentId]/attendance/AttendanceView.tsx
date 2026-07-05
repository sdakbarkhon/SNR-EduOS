"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale, AttendanceStatus } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ParentChild } from "@/lib/parent-child";

type Record_ = {
  id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_topic: string;
  subject: string;
  lesson_date: string;
  status: AttendanceStatus;
  marked_at: string | null;
};

const LOCALE_TAG: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: "#20B6C6",
  absent_excused: "#F5A623",
  absent_unexcused: "#F5455C",
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AttendanceView({ child, records }: { child: ParentChild; records: Record_[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;
  const tag = LOCALE_TAG[locale] ?? "ru-RU";

  const [cursor, setCursor] = useState(() => new Date());
  const cursorKey = monthKey(cursor);

  const byDay = useMemo(() => {
    const map = new Map<string, Record_>();
    for (const r of records) {
      if (monthKey(new Date(r.lesson_date)) !== cursorKey) continue;
      const dayKey = new Date(r.lesson_date).toISOString().slice(0, 10);
      const existing = map.get(dayKey);
      // приоритет отображения при нескольких уроках в день: unexcused > excused > present
      const rank: Record<AttendanceStatus, number> = { absent_unexcused: 2, absent_excused: 1, present: 0 };
      if (!existing || rank[r.status] > rank[existing.status]) map.set(dayKey, r);
    }
    return map;
  }, [records, cursorKey]);

  const monthRecords = useMemo(
    () => records.filter((r) => monthKey(new Date(r.lesson_date)) === cursorKey),
    [records, cursorKey],
  );
  const total = monthRecords.length;
  const present = monthRecords.filter((r) => r.status === "present").length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Пн=0

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.attendanceTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {child.full_name}
          {child.className ? ` · ${child.className}` : ""}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold capitalize text-gray-700">
            {cursor.toLocaleDateString(tag, { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {monthRecords.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t.noAttendanceRecords}</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {cells.map((day, i) => {
              if (day == null) return <div key={`b${i}`} />;
              const dayIso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const rec = byDay.get(dayIso);
              return (
                <div
                  key={day}
                  className="flex aspect-square items-center justify-center rounded-lg text-xs font-semibold"
                  style={
                    rec
                      ? { backgroundColor: `${STATUS_COLOR[rec.status]}1A`, color: STATUS_COLOR[rec.status] }
                      : { color: "#B7B7CE" }
                  }
                  title={
                    rec
                      ? rec.status === "present"
                        ? t.statusPresent
                        : rec.status === "absent_excused"
                          ? t.statusExcused
                          : t.statusAbsent
                      : undefined
                  }
                >
                  {day}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR.present }} />
              {t.statusPresent}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR.absent_excused }} />
              {t.statusExcused}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR.absent_unexcused }} />
              {t.statusAbsent}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase text-gray-400">{t.attendancePercentage}</p>
            <p className="text-lg font-black text-gray-800">{percentage}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
