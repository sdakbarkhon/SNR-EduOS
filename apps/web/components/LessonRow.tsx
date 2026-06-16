import type { StatusVariant } from "@snr/ui-tokens";
import { cn } from "@/lib/cn";
import { StatusChip } from "./StatusChip";
import { SubjectIcon } from "./SubjectIcon";

export function LessonRow({
  time,
  duration,
  subject,
  title,
  room,
  teacher,
  colorBar,
  status,
  onClick,
}: {
  time: string;
  duration?: string;
  subject: string | null;
  title: string;
  room?: string | null;
  teacher?: string | null;
  colorBar?: string;
  status?: { variant: StatusVariant; label: string };
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" } : {})}
      className={cn(
        "group relative flex w-full items-center overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-4 text-left shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl transition",
        onClick && "cursor-pointer hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
      )}
    >
      {/* Цветная полоска слева (цвет предмета) */}
      {colorBar && (
        <div
          className="absolute left-0 top-1/2 h-12 w-1.5 -translate-y-1/2 rounded-r-full"
          style={{ backgroundColor: colorBar }}
        />
      )}

      {/* Время + длительность */}
      <div className="w-[72px] shrink-0 pl-4">
        <span className="block text-[15px] font-bold text-blue-500">{time}</span>
        {duration && (
          <span className="block text-[11px] font-semibold text-gray-400 mt-0.5">
            {duration}
          </span>
        )}
      </div>

      {/* Иконка предмета */}
      <div className="mx-3 shrink-0">
        <SubjectIcon subject={subject} size={36} />
      </div>

      {/* Название + подпись */}
      <div className="min-w-0 flex-1 px-1">
        <div className="truncate text-[15px] font-bold text-gray-900">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {teacher ? teacher : room ? `каб. ${room}` : null}
        </div>
      </div>

      {/* Кабинет */}
      {room && (
        <div className="hidden w-20 shrink-0 text-center text-sm font-medium text-gray-500 sm:block">
          {room}
        </div>
      )}

      {/* Статус */}
      {status && (
        <div className="ml-2 shrink-0">
          <StatusChip variant={status.variant}>{status.label}</StatusChip>
        </div>
      )}
    </Tag>
  );
}
