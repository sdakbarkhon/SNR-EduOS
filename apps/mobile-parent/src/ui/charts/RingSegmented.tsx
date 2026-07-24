/**
 * RingSegmented — параметрическое многосегментное кольцо (для посещаемости).
 * Перенос из макета «SNR EduOS v2 Light.dc.html» — эталон §s5 «Библиотека», строка 2748:
 *   size 62, viewBox 88×88, cx=cy=44, r=30, thickness 11, C = 2π·30 ≈ 188.5.
 *   Раскладка:
 *     — красная база (rgba 239,68,68,.85) — полный круг, БЕЗ dasharray;
 *     — янтарная (#F59E0B) dasharray "47 188.5" dashoffset −141 rotate(−90);
 *     — зелёная (#10B981) dasharray "141 188.5"           rotate(−90);
 *   Итого: зелёная лежит СВЕРХУ (в Z-порядке — последняя нарисована), поверх янтаря,
 *   которая поверх красной базы. Числа 141/47 — прямые следствия %-сумм в data.
 *   linecap НЕ round (butt, default) — иначе короткие сегменты «съедает» скругление,
 *   и стыки станут неровные. Это отличие от Ring — тот всегда linecap=round.
 *
 * Полярная математика:
 *   r = (size − thickness) / 2 ; C = 2·π·r
 *   Пусть segments = [{color, value}]. total = max ?? Σ value.
 *   Сегмент i:
 *     lenᵢ    = C · valueᵢ / total
 *     offsetᵢ = −C · (Σ value_{0..i−1}) / total       // отрицательный, «сдвиг узора назад»
 *     dasharray = `${lenᵢ} ${C}`  ,  dashOffset = offsetᵢ
 *   Все сегменты — rotate(−90 cx cy). Так формула воспроизводит числа мокапа при total=100 и
 *   values [74.8, 24.9] (green 141, amber 47 offset −141) — с точностью округления SVG.
 *
 * baseColor — опциональная «подложка» полным кольцом (в макете это red-base 94%-варианта).
 * Если baseColor нет — рисуем trackColor как в Ring (тема-aware).
 *
 * Тексты: как в Ring — через centerContent, RN <Text> абсолютом.
 */
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../theme";

export interface RingSegment {
  color: string;
  value: number;
}

export interface RingSegmentedProps {
  /** Сегменты в порядке следования по кругу (первый — от 12 часов по часовой). */
  segments: RingSegment[];
  /** Максимум шкалы; по умолчанию — сумма value. */
  max?: number;
  /** Рендерный размер квадрата в px (мокап: 62 и подобные). */
  size: number;
  /** Толщина обводки. */
  thickness: number;
  /** Радиус центральной линии в единицах viewBox. По умолчанию (viewBoxSize − thickness) / 2. */
  r?: number;
  /** Размер стороны viewBox. По умолчанию = size. В макете часто больше (напр. рендер 62 при viewBox 88 → воздух вокруг кольца). */
  viewBoxSize?: number;
  /** Полное фоновое кольцо (полный круг, ниже сегментов). Как «red-base» в §s5. */
  baseColor?: string;
  /** «Трек»-кольцо, если baseColor не задан. По умолчанию тема-aware. */
  trackColor?: string;
  /** Закругление концов сегментов. По умолчанию butt — см. шапку. */
  linecap?: "round" | "butt" | "square";
  /** Контент по центру (RN <Text> с fonts.*). */
  centerContent?: ReactNode;
}

export function RingSegmented({
  segments,
  max,
  size,
  thickness,
  baseColor,
  r: rProp,
  viewBoxSize: viewBoxSizeProp,
  trackColor,
  linecap = "butt",
  centerContent,
}: RingSegmentedProps) {
  const { scheme } = useTheme();
  const vb = viewBoxSizeProp ?? size;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = rProp ?? (vb - thickness) / 2;
  const C = 2 * Math.PI * r;

  const total =
    max ?? segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  const defaultTrack =
    scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.09)";
  const track = trackColor ?? defaultTrack;

  // Кумулятивная сумма ПЕРЕД сегментом i (в единицах value).
  let cumulativeBefore = 0;
  const arcs = segments.map((seg) => {
    const before = cumulativeBefore;
    cumulativeBefore += Math.max(0, seg.value);
    const len = total === 0 ? 0 : C * (Math.max(0, seg.value) / total);
    const offset = total === 0 ? 0 : -C * (before / total);
    return { color: seg.color, len, offset };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
        {/* Слой 1: базовый фон — либо полное кольцо baseColor, либо тонкий трек. */}
        {baseColor ? (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={baseColor}
            strokeWidth={thickness}
          />
        ) : (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={track}
            strokeWidth={thickness}
          />
        )}
        {/* Слой 2..N: сегменты. Порядок Z — как в массиве (последний сверху). */}
        {arcs.map((a, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeLinecap={linecap}
            strokeDasharray={`${a.len} ${C}`}
            strokeDashoffset={a.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
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
