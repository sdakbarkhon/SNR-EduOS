/**
 * Иконки экрана входа — 1:1 порт apps/mobile-parent/src/ui/auth/icons.tsx
 * (только те, что используются на LoginPhoneScreen). Пути SVG — дословно.
 */
type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function BackArrowIcon({ size = 18, color = "#171243", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 11, color = "rgba(26,19,74,0.5)", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, color = "rgba(26,19,74,0.45)", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m9 6 6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkleIcon({ size = 18, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.6 12.5c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3.1.7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.7zM15.6 6c.6-.7 1-1.7.9-2.6-.8 0-1.9.5-2.4 1.2-.5.6-1 1.6-.8 2.6.9.1 1.8-.5 2.3-1.2z" />
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
