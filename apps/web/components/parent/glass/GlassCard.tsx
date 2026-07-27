import type { ReactNode, CSSProperties } from "react";
import { glass1Css, glass2Css, glassBorder, glassInsetCss, shCardCss, radius } from "@/lib/parent/glass-tokens";

export function GlassCard({
  children,
  className = "",
  variant = "glass1",
  style,
}: {
  children: ReactNode;
  className?: string;
  variant?: "glass1" | "glass2";
  style?: CSSProperties;
}) {
  const surface = variant === "glass1" ? glass1Css : glass2Css;
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        ...surface,
        borderRadius: radius.card,
        border: `1px solid ${glassBorder}`,
        boxShadow: `${shCardCss}, ${glassInsetCss}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
