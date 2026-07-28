"use client";

import type { ReactNode } from "react";
import { glass1Css, glassBorder } from "@/lib/parent/glass-tokens";

/** Круглая glass-кнопка 38×38 — 1:1 с apps/mobile-parent GlassCircleButton (ui/RootHeader.tsx). */
export function GlassCircleButton({
  onClick,
  children,
  ariaLabel,
}: {
  onClick?: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
      style={{ ...glass1Css, border: `1px solid ${glassBorder}` }}
    >
      {children}
    </button>
  );
}
