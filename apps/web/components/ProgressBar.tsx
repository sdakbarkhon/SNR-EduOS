import { colors } from "@snr/ui-tokens";

export function ProgressBar({
  value,
  color = colors.primary,
}: {
  value: number;
  color?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-chip"
      style={{ backgroundColor: colors.bgAppAlt }}
    >
      <div
        className="h-full rounded-chip"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}
