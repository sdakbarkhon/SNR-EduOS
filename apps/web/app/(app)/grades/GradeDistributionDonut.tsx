const TIER_COLORS: Record<5 | 4 | 3 | 2 | 1, string> = {
  5: "#22c55e",
  4: "#14b8a6",
  3: "#f5b81f",
  2: "#fb923c",
  1: "#f43f5e",
};
const TIER_ORDER = [5, 4, 3, 2, 1] as const;

const R = 54;
const CX = 70;
const CY = 70;
const CIRC = 2 * Math.PI * R;
const SW = 16;
const GAP = 4;

export function GradeDistributionDonut({
  counts,
  totalLabel,
  tierLabels,
}: {
  counts: Record<5 | 4 | 3 | 2 | 1, number>;
  totalLabel: string;
  tierLabels: Record<5 | 4 | 3 | 2 | 1, string>;
}) {
  const total = TIER_ORDER.reduce((s, k) => s + counts[k], 0);
  const nonZero = TIER_ORDER.filter((k) => counts[k] > 0);

  let prevSum = 0;
  const arcs = TIER_ORDER.map((k) => {
    const frac = total > 0 ? counts[k] / total : 0;
    const gapToSubtract = nonZero.length > 1 && counts[k] > 0 ? GAP : 0;
    const arcLen = Math.max(0, frac * CIRC - gapToSubtract);
    const offset = CIRC / 4 - prevSum;
    prevSum += frac * CIRC;
    return { key: k, color: TIER_COLORS[k], arcLen, offset };
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[128px] w-[128px] shrink-0">
        <svg viewBox="0 0 140 140" width={128} height={128} className="block">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={SW} />
          {total === 0
            ? null
            : arcs.map((arc) =>
                arc.arcLen < 1 ? null : (
                  <circle
                    key={arc.key}
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={SW}
                    strokeDasharray={`${arc.arcLen} ${CIRC - arc.arcLen}`}
                    strokeDashoffset={arc.offset}
                    strokeLinecap="round"
                  />
                ),
              )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{totalLabel}</span>
          <span className="mt-0.5 text-2xl font-black leading-none text-slate-800">{total}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {TIER_ORDER.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TIER_COLORS[k] }} />
            <span className="flex-1 text-[12.5px] font-semibold text-slate-600">{tierLabels[k]}</span>
            <span className="text-sm font-extrabold text-slate-800">{counts[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
