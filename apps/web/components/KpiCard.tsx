import type { ReactNode } from "react";
import { GlassCard } from "./GlassCard";

export function KpiCard({
  icon,
  title,
  value,
  footer,
}: {
  icon?: ReactNode;
  title: string;
  value: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <GlassCard className="flex min-h-[120px] flex-col justify-between p-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-3 text-xl font-bold text-gray-900">{value}</div>
      {footer && (
        <div className="mt-1 text-[13px] text-gray-400">{footer}</div>
      )}
    </GlassCard>
  );
}
