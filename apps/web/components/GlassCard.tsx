import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border bg-[var(--glass-bg)] border-[var(--glass-border)] shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
