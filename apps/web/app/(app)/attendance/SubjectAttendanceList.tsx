import {
  attendanceCalcAll,
  defaultLocale,
  getDictionary,
  getSubjectStyle,
  type AttendanceWithLesson,
} from "@snr/core";
import { SubjectIcon } from "@/components";

export function SubjectAttendanceList({ rows }: { rows: AttendanceWithLesson[] }) {
  const d = getDictionary(defaultLocale);
  const { bySubject } = attendanceCalcAll(rows);

  if (bySubject.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">{d.attendance.empty}</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {bySubject.map(({ subject, pct }) => {
        const style = getSubjectStyle(subject);
        return (
          <div key={subject} className="group flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {/* Иконка — стиль из poseshayemost.zip SubjectProgress */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60 shadow-sm border border-white/50 transition-transform duration-200 group-hover:scale-105">
                <SubjectIcon subject={subject} size={22} />
              </div>
              {/* Название */}
              <span className="flex-1 text-[14px] font-medium text-gray-800">
                {style.label}
              </span>
              {/* % */}
              <span
                className="text-[18px] font-bold"
                style={{ color: style.color }}
              >
                {pct}%
              </span>
            </div>
            {/* Прогресс-бар h-2.5 + bg-black/[0.04] shadow-inner из zip */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/[0.04] shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: style.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
