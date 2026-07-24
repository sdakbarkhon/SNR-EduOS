/**
 * MiniRing — компактное кольцо с процентом в центре.
 * Обёртка над Ring для типовой связки «мини-кольцо + число %», встречающейся в макете
 * «SNR EduOS v2 Light.dc.html»:
 *   • #12 ДЗ 42×42 — строки 512, 517: 100% зелёное #10B981, 60% оранжевое #F97316,
 *     r 16, thickness 4.5, шрифт цифр 9.5px M800, цвет ink1 (100%) или в семье цвета (60%).
 *   • Библиотека 52×52 — строка 2750: 68% синее #0284C7, r 15, thickness 5, шрифт 10.5px M800, ink1.
 *
 * Параметризация: pct (0..100) → Ring value/max — вся геометрия наследуется от Ring.
 * Цвет цифр: labelColor, по умолчанию tokens.ink1 (в макете оба варианта используют ink1
 * для «сильных» значений; для «слабого» значения 60% семьи каст в c-oj-500 задаётся явно).
 *
 * Тексты: RN <Text> в centerContent — шрифт Manrope 800, размер по умолчанию ≈ size · 0.22
 * (даёт 9.24 для 42 и 11.44 для 52 — в границах макета 9.5–10.5, при желании перекрыть fontSize).
 * Абсолютным overlay-ом (см. Ring), не через <SvgText> — не тянем шрифты в SVG.
 */
import { Text } from "react-native";
import { useTheme, fonts } from "../../theme";
import { Ring } from "./Ring";

export interface MiniRingProps {
  /** Процент (0..100). */
  pct: number;
  /** Диаметр в px. По умолчанию 52 (как в «Библиотеке» §s5). */
  size?: number;
  /** Толщина обводки. По умолчанию 5 (для 52) — при size=42 стоит задать 4.5. */
  thickness?: number;
  /** Цвет дуги прогресса. */
  color: string;
  /** Цвет фонового «трек»-круга (по умолчанию — тема-aware из Ring). */
  trackColor?: string;
  /** Показывать число процента внутри. По умолчанию true. */
  showPercent?: boolean;
  /** Цвет цифр. По умолчанию tokens.ink1. */
  labelColor?: string;
  /** Размер шрифта. По умолчанию round(size · 0.22) — попадает в 9.5–10.5 макета. */
  labelFontSize?: number;
}

export function MiniRing({
  pct,
  size = 52,
  thickness = 5,
  color,
  trackColor,
  showPercent = true,
  labelColor,
  labelFontSize,
}: MiniRingProps) {
  const { tokens } = useTheme();
  const fontSize = labelFontSize ?? Math.round(size * 0.22);
  const textColor = labelColor ?? tokens.ink1;
  const value = Math.max(0, Math.min(100, pct));

  return (
    <Ring
      value={value}
      max={100}
      size={size}
      thickness={thickness}
      color={color}
      trackColor={trackColor}
      centerContent={
        showPercent ? (
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize,
              color: textColor,
            }}
          >
            {Math.round(value)}%
          </Text>
        ) : null
      }
    />
  );
}
