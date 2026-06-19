import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function GlassCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[24px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
