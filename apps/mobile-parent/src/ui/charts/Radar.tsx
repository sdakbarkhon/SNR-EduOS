/**
 * Radar — параметрический шестиугольный радар на 6 осях.
 * Перенос из макета «SNR EduOS v2 Light.dc.html»:
 *  - §s5 «Библиотека» — 84×76 фиолетовый без подписей (строка 2747)
 *  - П10 «Успехи», вкладка «Навыки» — 200×172 фиолетовый (строка 351)
 *  - #16 «Навыки» — 240×196 синий с 6 подписями по осям (строка 663)
 *
 * Внутренние координаты — как у макета: центр (60, 54), внешний радиус R = 44.
 *   Верхняя вершина (60, 10): (60−60, 10−54) → dy = −44, дистанция 44.
 *   Правая-верхняя (98, 32): (38, −22) → sqrt(1444+484)=√1928 ≈ 43.9 ≈ R.
 * Оси идут по часовой стрелке от «верх» с шагом 60°.
 *   Мат-угол i-й оси: aᵢ = −π/2 + i · (π/3), i = 0..5.
 *   Вершина полигона данных: (cx + R·(vᵢ/max)·cos aᵢ, cy + R·(vᵢ/max)·sin aᵢ).
 *   SVG y растёт вниз, но математический +y при −π/2 даёт −1 → cy − R,
 *   т.е. верх — как и ожидается.
 *   Проверки:
 *     v=[max×6] → внешний шестиугольник (совпадает с сеткой);
 *     v=[0×6]  → все точки схлопываются в (cx, cy).
 *
 * viewBox по умолчанию «0 0 120 108» (совпадает с mini/П10). При включённых
 * подписях (labels) используется расширенный «−14 0 148 108», чтобы текст не
 * обрезался — так же, как на #16.
 *
 * Шрифт подписей: react-native-svg <Text> — чтобы координаты подписей задавать
 * в тех же viewBox-единицах, что и вершины полигона (иначе пришлось бы
 * пересчитывать оффсеты RN-<Text> при каждом изменении внешнего size).
 */
import { View } from "react-native";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme";
import { fonts } from "../../theme/tokens";

const CX = 60;
const CY = 54;
const R = 44;

/** Стандартные позиции подписей вокруг гексагона — как на #16 (строка 663). */
const LABEL_POS: Array<{ x: number; y: number; anchor: "start" | "middle" | "end" }> = [
  { x: 60, y: 7, anchor: "middle" }, // ось 0 — верх
  { x: 102, y: 30, anchor: "start" }, // ось 1 — верх-право
  { x: 102, y: 82, anchor: "start" }, // ось 2 — низ-право
  { x: 60, y: 106, anchor: "middle" }, // ось 3 — низ
  { x: 18, y: 82, anchor: "end" }, // ось 4 — низ-лево
  { x: 18, y: 30, anchor: "end" }, // ось 5 — верх-лево
];

function hexPoints(radius: number): string {
  // Замкнутый гексагон в тех же 6 углах, что и оси данных.
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 3);
    const x = CX + radius * Math.cos(a);
    const y = CY + radius * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export interface RadarProps {
  /** 6 значений (0..max). Длина массива фиксирована — 6 осей. */
  values: [number, number, number, number, number, number] | number[];
  /** Максимум шкалы. Дефолт 5 — «оценки». */
  max?: number;
  /** Внешняя ширина. Высота считается как size * viewBoxH/viewBoxW. */
  size?: number;
  /** Заливка полигона данных. */
  fillColor?: string;
  /** Обводка полигона данных. */
  strokeColor?: string;
  /** Толщина обводки полигона данных в viewBox-единицах. Дефолт 2. */
  strokeWidth?: number;
  /** Показать сетку 50%. Дефолт true (как на #16 и на П10). Для мини — false. */
  showHalfGrid?: boolean;
  /** Подписи 6 осей. Если заданы — включается расширенный viewBox под текст. */
  labels?: [string, string, string, string, string, string] | string[];
  /** Размер шрифта подписей в viewBox-единицах. Дефолт 7.5 (макет #16). */
  labelFontSize?: number;
}

export function Radar({
  values,
  max = 5,
  size = 200,
  fillColor,
  strokeColor,
  strokeWidth = 2,
  showHalfGrid = true,
  labels,
  labelFontSize = 7.5,
}: RadarProps) {
  const { tokens } = useTheme();

  const outerGridStroke =
    tokens.scheme === "light" ? "rgba(23,18,67,0.14)" : "rgba(255,255,255,0.14)";
  const halfGridStroke =
    tokens.scheme === "light" ? "rgba(23,18,67,0.09)" : "rgba(255,255,255,0.09)";
  const labelFill = tokens.ink2;

  const fill = fillColor ?? `rgba(${tokens.status.violet.rgb},0.28)`;
  const stroke = strokeColor ?? tokens.accent;

  const outerHex = hexPoints(R);
  const halfHex = hexPoints(R / 2);

  const dataPoints = Array.from({ length: 6 }, (_, i) => {
    const raw = values[i] ?? 0;
    const ratio = Math.max(0, Math.min(1, max > 0 ? raw / max : 0));
    const a = -Math.PI / 2 + i * (Math.PI / 3);
    const x = CX + R * ratio * Math.cos(a);
    const y = CY + R * ratio * Math.sin(a);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const hasLabels = Array.isArray(labels) && labels.length >= 6;
  const viewBox = hasLabels ? "-14 0 148 108" : "0 0 120 108";
  const vbW = hasLabels ? 148 : 120;
  const vbH = 108;
  const height = size * (vbH / vbW);

  return (
    <View>
      <Svg width={size} height={height} viewBox={viewBox}>
        <Polygon points={outerHex} fill="none" stroke={outerGridStroke} strokeWidth={1.5} />
        {showHalfGrid ? (
          <Polygon points={halfHex} fill="none" stroke={halfGridStroke} strokeWidth={1} />
        ) : null}
        <Polygon points={dataPoints} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        {hasLabels
          ? LABEL_POS.map((pos, i) => (
              <SvgText
                key={i}
                x={pos.x}
                y={pos.y}
                textAnchor={pos.anchor}
                fontFamily={fonts.manrope700}
                fontSize={labelFontSize}
                fontWeight="700"
                fill={labelFill}
              >
                {labels![i]}
              </SvgText>
            ))
          : null}
      </Svg>
    </View>
  );
}
