import type { InputHTMLAttributes } from "react";
import { glass2Css, glassBorder, ink1, radius } from "@/lib/parent/glass-tokens";

export function GlassInput({ className = "", style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`w-full px-4 py-3.5 text-[15px] outline-none placeholder:text-slate-400 ${className}`}
      style={{
        ...glass2Css,
        color: ink1,
        borderRadius: radius.tile,
        border: `1px solid ${glassBorder}`,
        ...style,
      }}
    />
  );
}
