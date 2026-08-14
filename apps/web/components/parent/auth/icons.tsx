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

/* GoogleIcon и AppleIcon удалены 14.08.2026 вместе с кнопками входа через
   сторонние учётные записи на LoginPhoneScreen.tsx: те кнопки никуда не
   вели (тост «Скоро»), входа через Google/Apple у нас нет и не планируется.
   Других потребителей у иконок не было — у ученического экрана входа
   (app/login/LoginForm.tsx) свой локальный глиф Google. */

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
