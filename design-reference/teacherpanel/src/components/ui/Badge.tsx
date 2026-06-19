import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

export function Badge({ className, variant = 'gray', children, ...props }: BadgeProps) {
  const variants = {
    blue: "bg-blue-100/80 text-blue-700 border-blue-200/50",
    green: "bg-emerald-100/80 text-emerald-700 border-emerald-200/50",
    yellow: "bg-amber-100/80 text-amber-700 border-amber-200/50",
    red: "bg-rose-100/80 text-rose-700 border-rose-200/50",
    gray: "bg-gray-100/80 text-gray-700 border-gray-200/50",
  };

  return (
    <span 
      className={cn(
        "px-2.5 py-1 rounded-[8px] text-[11px] font-semibold tracking-wide border backdrop-blur-sm",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
