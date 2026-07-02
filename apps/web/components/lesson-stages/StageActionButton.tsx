"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "success";
type Size = "default" | "sm";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-fuchsia-700",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10",
  success:
    "bg-emerald-600 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-700",
};

const SIZE_CLASSES: Record<Size, string> = {
  default: "px-4 py-2 text-sm",
  sm: "px-3.5 py-1.5 text-sm",
};

const ICON_SIZE: Record<Size, string> = {
  default: "h-4 w-4",
  sm: "h-3.5 w-3.5",
};

/**
 * Unified action button for lesson stages — Часть 5, Iter5 P6. Reused by
 * CodeStageView (Запустить/Сдать) and ExternalStageModal (Сдать) so every
 * stage type presents the same visual language for run/submit actions.
 */
export function StageActionButton({
  variant = "primary",
  size = "default",
  icon: Icon,
  loading,
  disabled,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className={cn(ICON_SIZE[size], "animate-spin")} />
      ) : Icon ? (
        <Icon className={ICON_SIZE[size]} />
      ) : null}
      {children}
    </button>
  );
}
