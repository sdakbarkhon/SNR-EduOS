import { colors } from "@snr/ui-tokens";

export function RingProgress({
  value,
  size = 64,
  stroke = 8,
  color = colors.primary,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const center = size / 2;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={r} fill="none" stroke={colors.bgAppAlt} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-text-primary">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
