import type { ReactNode } from "react";
import { statusColors, type StatusVariant } from "@snr/ui-tokens";

export function StatusChip({
  variant,
  children,
}: {
  variant: StatusVariant;
  children: ReactNode;
}) {
  const c = statusColors[variant];
  return (
    <span
      className="inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {children}
    </span>
  );
}
