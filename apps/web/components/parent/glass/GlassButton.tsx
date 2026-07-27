import type { ButtonHTMLAttributes } from "react";
import { accentGradCss, glass2Css, glassBorder, ink1, radius } from "@/lib/parent/glass-tokens";

type Variant = "primary" | "secondary";

export function GlassButton({
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const primaryStyle = {
    background: accentGradCss,
    color: "#fff",
    boxShadow: "0 10px 24px rgba(99,86,214,0.30)",
  };
  const secondaryStyle = {
    ...glass2Css,
    color: ink1,
    border: `1px solid ${glassBorder}`,
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      className={`flex w-full items-center justify-center px-5 py-3.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${className}`}
      style={{
        borderRadius: radius.tile,
        ...(variant === "primary" ? primaryStyle : secondaryStyle),
      }}
    />
  );
}
