import type { HomeworkCounts } from "@snr/core";

// Цвета из domashnie_zadaniya.zip StatsCard
const SEGMENTS = [
  { key: "active" as const, color: "#3b82f6", label: "Активные" },
  { key: "completed" as const, color: "#0ea5e9", label: "Выполненные" },
  { key: "overdue" as const, color: "#ec4899", label: "Просроченные" },
  { key: "review" as const, color: "#fbbf24", label: "На проверке" },
];

const R = 54;
const CX = 70;
const CY = 70;
const CIRC = 2 * Math.PI * R; // 339.29
const SW = 16;
const GAP = 4; // пикселей зазора между секторами (как paddingAngle в recharts)

export function HomeworkStatsDonut({
  counts,
  statsLabel,
  totalLabel,
}: {
  counts: HomeworkCounts;
  statsLabel: string;
  totalLabel: string;
}) {
  const total = counts.total;

  // Строим дуги с зазорами
  type Arc = { color: string; arcLen: number; offset: number };
  const nonZero = SEGMENTS.filter((s) => counts[s.key] > 0);
  let prevSum = 0;
  const arcs: Arc[] = SEGMENTS.map((s) => {
    const count = counts[s.key];
    const frac = total > 0 ? count / total : 0;
    const gapToSubtract = nonZero.length > 1 && count > 0 ? GAP : 0;
    const arcLen = Math.max(0, frac * CIRC - gapToSubtract);
    const offset = CIRC / 4 - prevSum;
    prevSum += frac * CIRC;
    return { color: s.color, arcLen, offset };
  });

  return (
    // Карточка — стиль из архива
    <div className="rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">{statsLabel}</h3>

      <div className="flex items-center gap-6">
        {/* SVG пончик */}
        <div className="relative w-40 h-40 shrink-0">
          <svg viewBox="0 0 140 140" width={160} height={160} className="block">
            {/* Фоновое кольцо */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={SW}
            />
            {total === 0
              ? null
              : arcs.map((arc, i) =>
                  arc.arcLen < 1 ? null : (
                    <circle
                      key={i}
                      cx={CX}
                      cy={CY}
                      r={R}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={SW}
                      strokeDasharray={`${arc.arcLen} ${CIRC - arc.arcLen}`}
                      strokeDashoffset={arc.offset}
                      strokeLinecap="butt"
                    />
                  ),
                )}
          </svg>
          {/* Центральный текст — поверх SVG */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide text-center leading-tight px-2">
              {totalLabel}
            </span>
            <span className="text-2xl font-bold text-slate-800 leading-none mt-0.5">
              {total}
            </span>
          </div>
        </div>

        {/* Легенда */}
        <div className="flex flex-col gap-3 flex-1">
          {SEGMENTS.map((s) => (
            <div
              key={s.key}
              className="flex flex-row items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-600 text-xs">{s.label}</span>
              </div>
              <span className="font-semibold text-slate-800 text-sm">
                {counts[s.key]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
