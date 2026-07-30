import type { InputHTMLAttributes } from "react";
import { glass2Css, glassBorder, ink1, radius } from "@/lib/parent/glass-tokens";

/**
 * Плейсхолдер — единственное здесь, что нельзя задать инлайн-стилем
 * (::placeholder — псевдоэлемент). Раньше это был Tailwind-класс
 * `placeholder:text-slate-400`, но app/globals.css держит ГОЛОЕ правило
 * `.dark input::placeholder { color:#6a78a8 }` для ученических форм, и оно
 * специфичнее утилиты (.dark input::placeholder = 0-1-2 против 0-1-1). С
 * появлением тёмной темы у родителя класс `dark` доезжает и до /parent, так
 * что утилиту перебивало бы чужим цветом. Поэтому цвет берётся из токена темы
 * (--p-placeholder, обе схемы — в app/parent/parent-theme.css) и помечен `!`:
 * !important выигрывает у голого правила независимо от специфичности.
 */
const PLACEHOLDER = "placeholder:!text-[color:var(--p-placeholder,#94a3b8)]";

export function GlassInput({ className = "", style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`w-full px-4 py-3.5 text-[15px] outline-none ${PLACEHOLDER} ${className}`}
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
