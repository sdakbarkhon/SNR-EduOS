/**
 * Иконки экранов входа (A1–A4 и шторок) — SVG-обёртки поверх react-native-svg.
 * Экраны не импортируют react-native-svg напрямую (правило Захода 4).
 * Все пути — 1:1 из макета «SNR EduOS v2 Light.dc.html».
 */
import Svg, { G, Path, Rect } from "react-native-svg";

export interface AuthIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Стрелка «назад» — та же, что в InnerHeader (18 stroke 2). */
export function BackArrowIcon({ size = 18, color = "#171243", strokeWidth = 2 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="m12 19-7-7 7-7" />
    </Svg>
  );
}

/** Chevron down (селектор страны, стрелка demo-CTA). Строка ~1990. */
export function ChevronDownIcon({ size = 11, color = "rgba(26,19,74,0.5)", strokeWidth = 2 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m6 9 6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Chevron right — сортировка/навигация. */
export function ChevronRightIcon({ size = 16, color = "rgba(26,19,74,0.45)", strokeWidth = 2 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9 6 6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Sparkle-звезда — demo-CTA (строка 2005 макета). */
export function SparkleIcon({ size = 18, color = "#FFFFFF" }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z" />
    </Svg>
  );
}

/** Shield-check — security-стрип A3/A4 (строки 2033, 2057). */
export function ShieldCheckIcon({ size = 16, color = "#6D28D9", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m9 12 2 2 4-4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Backspace (⌫) — кнопка удаления PIN-клавиатуры A3. */
export function BackspaceIcon({ size = 20, color = "#171243", strokeWidth = 2 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 3H7L2 12l5 9h15a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m18 9-6 6M12 9l6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Галочка (использована галочка в selected radio на A4). */
export function CheckIcon({ size = 12, color = "#FFFFFF", strokeWidth = 3 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6 9 17l-5-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Крестик — закрытие/крестик демо-баннера. */
export function CloseIcon({ size = 14, color = "#171243", strokeWidth = 2 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6 6 18M6 6l12 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Google G — multicolor (Phone-экран). */
export function GoogleIcon({ size = 18 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.4-4.9 3.4-8.4z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 20.5 7.5 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.6 13.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3v-3H1.8C1 7.8.5 9.8.5 11.5s.5 3.7 1.3 5.3l3.8-3z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15.1.5 12 .5 7.5.5 3.7 3 1.8 6.5l3.8 3c.9-2.7 3.4-4.5 6.4-4.5z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/** Apple — одноцветная (Phone-экран). */
export function AppleIcon({ size = 18, color = "#171243" }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.6 12.5c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3.1.7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.7zM15.6 6c.6-.7 1-1.7.9-2.6-.8 0-1.9.5-2.4 1.2-.5.6-1 1.6-.8 2.6.9.1 1.8-.5 2.3-1.2z" />
    </Svg>
  );
}

/** Флаг Узбекистана 18×13 — 3 горизонтальные полосы. */
export function UzFlagIcon({ size = 18 }: { size?: number }) {
  const h = Math.round((size / 18) * 13);
  return (
    <Svg width={size} height={h} viewBox="0 0 18 13">
      <Rect width={18} height={4.33} fill="#0099B5" />
      <Rect y={4.33} width={18} height={4.34} fill="#FFFFFF" />
      <Rect y={8.67} width={18} height={4.33} fill="#1EB53A" />
    </Svg>
  );
}

/** Feature-иконка: check-square (Успеваемость). */
export function CheckSquareIcon({ size = 18, color = "#FFFFFF", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 11l3 3 8-8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Feature-иконка: clipboard (Домашние задания). */
export function ClipboardIcon({ size = 18, color = "#FFFFFF", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={8} y={2} width={8} height={4} rx={1} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Feature-иконка: card (Оплаты). */
export function CreditCardIcon({ size = 18, color = "#FFFFFF", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={5} width={20} height={14} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M2 10h20" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Feature-иконка: chat (Связь). */
export function ChatIcon({ size = 18, color = "#FFFFFF", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Help-иконка: phone. */
export function PhoneIcon({ size = 18, color = "#FFFFFF", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Help-иконка: mail. */
export function MailIcon({ size = 18, color = "#FFFFFF", strokeWidth = 1.9 }: AuthIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h16c1 0 2 1 2 2v12c0 1-1 2-2 2H4c-1 0-2-1-2-2V6c0-1 1-2 2-2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m22 6-10 7L2 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Утилитарная общая обёртка контейнера пути (в макете это <g>) — не используется.
export { G };
