import type { ReactNode } from "react";

export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card bg-bg-card p-8 text-center text-text-muted shadow-card">
      {icon}
      <span className="text-sm">{children}</span>
    </div>
  );
}
