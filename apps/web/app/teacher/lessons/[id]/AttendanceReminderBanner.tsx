"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, CheckCircle2, ClipboardList, Award } from "lucide-react";
import { getDictionary, AUTO_END_GRACE_MINUTES } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Предупреждение о неоконченной перекличке.
 *
 * 23.08.2026. РАНЬШЕ СЧИТАЛ НЕ ТО. Баннер спрашивал у базы «есть ли по уроку
 * хоть одна строка посещаемости» и при первой же отметке замолкал. Учитель
 * отмечал одного ученика из двадцати — предупреждение сменялось на «Перекличка
 * сделана», а остальным девятнадцати автозавершение раздавало прогулы.
 *
 * ТЕПЕРЬ СЧИТАЕТ ПОЛНОТУ. Число неотмеченных приходит сверху, из самой
 * переклички (AttendanceRollCall → onStatusChange): она одна знает состав
 * группы. Пока неотмеченные есть — баннер висит, и в последние минуты он
 * красный.
 *
 * ЗАПАС ПОСЛЕ ЗВОНКА. Урок закрывается не по звонку, а через
 * AUTO_END_GRACE_MINUTES минут. Всё это время предупреждение остаётся на
 * экране: ровно тогда оно нужнее всего.
 */
export function AttendanceReminderBanner({
  endsAt,
  status,
  unmarkedCount,
  onScrollToRollCall,
}: {
  endsAt: string | null;
  status: string;
  /** Сколько учеников ещё не отмечено. null — перекличка ещё не загрузилась. */
  unmarkedCount: number | null;
  onScrollToRollCall: () => void;
}) {
  const { locale } = useLocale();
  const dl = getDictionary(locale as Locale).lesson;

  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // Update minutesLeft every 30 s
  useEffect(() => {
    if (status !== "in_progress" || !endsAt) return;
    const update = () => {
      setMinutesLeft((new Date(endsAt).getTime() - Date.now()) / 60_000);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [endsAt, status]);

  if (status !== "in_progress" || minutesLeft === null) return null;
  // Пока не знаем состав переклички — молчим: пугать вслепую хуже, чем ждать.
  if (unmarkedCount === null) return null;
  // Окно показа: за 15 минут до звонка и весь запас после него.
  if (minutesLeft > 15 || minutesLeft <= -AUTO_END_GRACE_MINUTES) return null;

  // После звонка идёт запас: показываем, сколько его осталось, а не «минус три».
  const inGrace = minutesLeft <= 0;
  const title = inGrace
    ? dl.attendanceGraceTitle.replace(
        "{minutes}",
        String(Math.max(1, Math.ceil(minutesLeft + AUTO_END_GRACE_MINUTES))),
      )
    : dl.attendanceReminderTitle.replace("{minutes}", String(Math.ceil(minutesLeft)));

  const countLine = dl.attendanceUnmarkedCount.replace("{count}", String(unmarkedCount));

  // Все отмечены — тревожить нечем. За пять минут до звонка напомним про оценки.
  if (unmarkedCount === 0) {
    if (inGrace || minutesLeft > 5) return null;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 shadow-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-800">{title}</p>
          <p className="text-sm text-amber-700">{dl.attendanceMadeCheckOthers}</p>
        </div>
        <Link
          href="/teacher/grades"
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
        >
          <Award className="h-3.5 w-3.5" /> {dl.openGrades}
        </Link>
      </div>
    );
  }

  // Остались неотмеченные. В последние пять минут и весь запас — красный.
  if (minutesLeft <= 5) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-800">{title}</p>
          <p className="text-sm text-red-700">
            {countLine} — {inGrace ? dl.attendanceAutoAbsentWarn : dl.attendanceReminderUrgent}
          </p>
        </div>
        <button
          onClick={onScrollToRollCall}
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700"
        >
          <ClipboardList className="h-3.5 w-3.5" /> {dl.makeAttendance}
        </button>
      </div>
    );
  }

  // 5–15 минут до звонка, кто-то ещё не отмечен → жёлтая подсказка.
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 shadow-sm">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-800">{title}</p>
        <p className="text-sm text-amber-700">
          {countLine} — {dl.attendanceReminderHint}
        </p>
      </div>
      <button
        onClick={onScrollToRollCall}
        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
      >
        <ClipboardList className="h-3.5 w-3.5" /> {dl.makeAttendance}
      </button>
    </div>
  );
}
