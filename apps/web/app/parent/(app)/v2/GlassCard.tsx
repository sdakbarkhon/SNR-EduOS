/**
 * Блок 7.1 — стеклянные поверхности v2 для веба.
 *
 * Перенос 1:1 из apps/mobile-parent/src/ui/GlassCard.tsx (ветка
 * feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html» §s10:
 * glass-1 160° W72→W46 blur 22, glass-2 160° W58→W36 blur 20,
 * glass-border W78, glass-inset «inset 0 1.5 0 W95», sh-card 0 14 34.
 *
 * В мобилке inset-блик рисовался отдельной линией-вьюхой (RN не умеет
 * inset-тени) и был отдельный fallback-режим без блюра — в вебе и то и
 * другое нативно, поэтому здесь ИСХОДНАЯ форма макета: настоящий
 * inset box-shadow + backdrop-filter.
 */
import type { CSSProperties, ReactNode } from "react";
import { glass1, glass2, glassBorder, glassInset, radius, shCard } from "./tokens";

export function GlassCard({
  variant = "glass1",
  radius: r = radius.card,
  className = "",
  style,
  onClick,
  children,
}: {
  variant?: "glass1" | "glass2";
  radius?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const g = variant === "glass2" ? glass2 : glass1;
  const surface: CSSProperties = {
    borderRadius: r,
    background: g.background,
    border: `1px solid ${glassBorder}`,
    backdropFilter: `blur(${g.blur}px)`,
    WebkitBackdropFilter: `blur(${g.blur}px)`,
    boxShadow: `${shCard}, ${glassInset}`,
    ...style,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`block w-full text-left transition-transform active:scale-[0.99] ${className}`}
        style={surface}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={className} style={surface}>
      {children}
    </div>
  );
}
