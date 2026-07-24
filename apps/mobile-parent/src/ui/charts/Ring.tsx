/**
 * Ring — параметрическое одноцветное кольцо прогресса.
 * Перенос из макета «SNR EduOS v2 Light.dc.html» — эталоны:
 *   • #6 «Статус дня» — строка 429: size 86, r 32, thickness 10, value 2/6 → dasharray "67 201".
 *   • #12 мини ДЗ 42×42 — строки 512, 517: r 16, thickness 4.5, 100% → "100.5 100.5", 60% → "60 100.5".
 *   • «Освоение тем» — строка 1421: size 72, r 32, thickness 9, 70% → "141 201".
 *   • «Тесты» на градиенте — строка 1546: size 70, r 32, thickness 9, 82% → "165 201".
 *   • Библиотека 52×52 — строка 2750: r 15, thickness 5, 68% → "64 94.2".
 *
 * Полярная математика (ключ параметризации — под ЛЮБОЕ value даёт корректную геометрию):
 *   r         — радиус центральной линии обводки. По умолчанию (size − thickness) / 2 —
 *                кольцо на всю ширину квадрата. В макете размер viewBox нередко БОЛЬШЕ
 *                рендерного размера (напр. 86×86 рендер / 88×88 viewBox, r=32), т.е. есть
 *                «воздух» ~2–7px по кругу. Чтобы совпало 1:1, вызывающий передаёт явные
 *                r и viewBoxSize (см. пример «Статус дня» в DevGallery).
 *   C         = 2·π·r                             // окружность = «длина эталона»
 *   pct       = clamp(value / max, 0, 1)
 *   len       = C · pct                           // длина дуги прогресса
 *   dasharray = `${len} ${C}`                     // штрих len + «дырка» C = единственный отрезок
 *   rotate(−90 cx cy)                             // старт с 12 часов, ход по часовой (SVG convention)
 *
 * Тексты: НЕ рисуем внутри Ring, чтобы не тянуть шрифты через <SvgText>. Родитель передаёт
 * centerContent (RN <Text> с fontFamily из tokens.fonts), кладём абсолютом по центру
 * — так проще с i18n и любыми макетными сочетаниями «число + подпись» (например «2/6» + «уроков»).
 * Presentational, тема только через useTheme() — для дефолтного цвета track.
 */
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../theme";

export interface RingProps {
  /** Текущее значение прогресса (0..max). */
  value: number;
  /** Максимум шкалы. По умолчанию 100 (для процентов). */
  max?: number;
  /** Рендерный размер квадрата в px (86, 72, 70, 68, 52, 42 — типичные размеры макета). */
  size: number;
  /** Толщина обводки (10, 9, 5, 4.5 — типичные). */
  thickness: number;
  /** Цвет дуги прогресса. */
  color: string;
  /** Радиус центральной линии обводки в единицах viewBox. По умолчанию (viewBoxSize − thickness) / 2. */
  r?: number;
  /** Размер стороны viewBox. По умолчанию = size (кольцо занимает весь квадрат). В макете часто больше size — задаёт «воздух» вокруг кольца. */
  viewBoxSize?: number;
  /** Цвет фонового «трек»-круга. По умолчанию тема-aware (светлая тёмно-фиол W09, тёмная белый .10). */
  trackColor?: string;
  /** Закругление концов дуги. По умолчанию round (все solo-кольца в макете). */
  linecap?: "round" | "butt" | "square";
  /** Контент по центру (обычно RN <Text> с fonts.manrope800). */
  centerContent?: ReactNode;
}

export function Ring({
  value,
  max = 100,
  size,
  thickness,
  color,
  r: rProp,
  viewBoxSize: viewBoxSizeProp,
  trackColor,
  linecap = "round",
  centerContent,
}: RingProps) {
  const { scheme } = useTheme();
  const vb = viewBoxSizeProp ?? size;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = rProp ?? (vb - thickness) / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const len = C * pct;

  const defaultTrack =
    scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.09)";
  const track = trackColor ?? defaultTrack;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={thickness}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap={linecap}
          strokeDasharray={`${len} ${C}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      {centerContent ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {centerContent}
        </View>
      ) : null}
    </View>
  );
}
