/**
 * Иконки экрана входа — 1:1 порт apps/mobile-parent/src/ui/auth/icons.tsx
 * (только те, что используются на LoginPhoneScreen). Пути SVG — дословно.
 *
 * ТЁМНАЯ ТЕМА: почему цвет здесь в style, а не в атрибуте.
 * Вызывающий передаёт в `color` токен вида `var(--p-ink1, #171243)`. Браузеры
 * НЕ разрешают var() в presentation-атрибутах SVG (fill=/stroke=) — значение
 * просто не разбирается, и глиф остаётся бесцветным в ОБЕИХ темах. В CSS-
 * свойстве (style) var() работает штатно, а CSS-свойство перебивает атрибут.
 * Поэтому цвет ушёл в style, а геометрия (strokeWidth/strokeLinecap/fill="none")
 * осталась атрибутами. Тот же приём уже применён в общем примитиве Glyph
 * (app/parent/(app)/_ui/screen-kit.tsx).
 */
type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function BackArrowIcon({ size = 18, color = "#171243", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 11, color = "rgba(26,19,74,0.5)", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }} />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, color = "rgba(26,19,74,0.45)", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m9 6 6 6-6 6" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }} />
    </svg>
  );
}

export function SparkleIcon({ size = 18, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ fill: color }}>
      <path d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z" />
    </svg>
  );
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.4-4.9 3.4-8.4z" fill="#4285F4" />
      <path d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 20.5 7.5 23 12 23z" fill="#34A853" />
      <path d="M5.6 13.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3v-3H1.8C1 7.8.5 9.8.5 11.5s.5 3.7 1.3 5.3l3.8-3z" fill="#FBBC05" />
      <path d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15.1.5 12 .5 7.5.5 3.7 3 1.8 6.5l3.8 3c.9-2.7 3.4-4.5 6.4-4.5z" fill="#EA4335" />
    </svg>
  );
}

export function AppleIcon({ size = 18, color = "#171243" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ fill: color }}>
      <path d="M17.6 12.5c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3.1.7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.7zM15.6 6c.6-.7 1-1.7.9-2.6-.8 0-1.9.5-2.4 1.2-.5.6-1 1.6-.8 2.6.9.1 1.8-.5 2.3-1.2z" />
    </svg>
  );
}

/** Глобус — кнопка выбора языка на онбординге/экране входа. */
export function GlobeIcon({ size = 17, color = "#171243", strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }}>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18" />
      <path d="M12 3a13 13 0 0 0 0 18" />
    </svg>
  );
}

/** Солнце — 1:1 с apps/mobile-parent LangSecurityScreen.tsx SunIcon. */
export function SunIcon({ size = 17, color = "#171243", strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }}>
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.3 17.7-1.4 1.4" />
      <path d="m19.1 4.9-1.4 1.4" />
    </svg>
  );
}

/** Луна — 1:1 с apps/mobile-parent LangSecurityScreen.tsx MoonIcon. */
export function MoonIcon({ size = 17, color = "#171243", strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/** Монитор — 1:1 с apps/mobile-parent LangSecurityScreen.tsx DeviceIcon («Системная»). */
export function MonitorIcon({ size = 17, color = "#FFFFFF", strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }}>
      <rect x={6} y={2} width={12} height={20} rx={3} />
      <path d="M12 18h.01" />
    </svg>
  );
}

/** Галочка — индикатор выбранного пункта в шторках языка/темы. */
export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function UzFlagIcon({ size = 18 }: { size?: number }) {
  const h = Math.round((size / 18) * 13);
  return (
    <svg width={size} height={h} viewBox="0 0 18 13">
      <rect width={18} height={4.33} fill="#0099B5" />
      <rect y={4.33} width={18} height={4.34} fill="#FFFFFF" />
      <rect y={8.67} width={18} height={4.33} fill="#1EB53A" />
    </svg>
  );
}
