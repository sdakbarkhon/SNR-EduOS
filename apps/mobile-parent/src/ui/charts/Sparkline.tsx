/**
 * Sparkline — параметрическая ломаная.
 * Перенос из макета «SNR EduOS v2 Light.dc.html»:
 *  - П10 «Успехи», карточка «Средний балл» — 56×20 внутри градиента,
 *    белая линия 2.2 без точки (строка 286).
 *  - П10 «Успехи», вкладка «Динамика» — 320×90 фиолетовая линия 3
 *    с точкой на конце (строка 362).
 *  - §s5 «Библиотека» — 104×34, стек 2.5, точка на конце (строка 2751).
 *
 * Каждый вызов рисует полилинию из массива values. Ось X — равномерно.
 * Ось Y — нормирована по локальному диапазону [minV, maxV] массива values, с
 * инверсией (большее значение → выше на экране, т.е. меньшее y в SVG). Если
 * все значения одинаковы — линия идёт ровно по вертикальному центру.
 *
 * Формулы (padding = strokeWidth для запаса под линию и «endDot»):
 *   xᵢ = padX + i · (width − 2·padX) / (n − 1)
 *   yᵢ = padY + (1 − (vᵢ − minV) / (maxV − minV)) · (height − 2·padY)
 *
 * preserveAspectRatio:
 *   'none' — растягивание под контейнер (как для П10 320×90 с width="100%").
 *   'xMidYMid meet' — сохраняет пропорции. Для мини-графиков макета обычно
 *   используется «none», чтобы линия точно вписалась в узкий бокс.
 *
 * Универсальный компонент не хардкодит точки из макета: при равномерных данных
 * с той же дельтой между шагами он даёт визуально идентичный результат.
 */
import { View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { useTheme } from "../../theme";

export interface SparklineProps {
  /** Числовые значения (минимум 2 точки). */
  values: number[];
  /** Ширина области (в тех же единицах, что и viewBox). Дефолт 120. */
  width?: number;
  /** Высота области. Дефолт 36. */
  height?: number;
  /** Цвет линии. Дефолт tokens.accent. */
  strokeColor?: string;
  /** Толщина линии. Дефолт 2.2 (мини 14×… из макета). */
  strokeWidth?: number;
  /** Нарисовать заливной кружок в конце линии. */
  endDot?: boolean;
  /** Радиус конечного кружка. Дефолт strokeWidth * 1.6. */
  endDotRadius?: number;
  /** Цвет конечного кружка. По умолчанию совпадает со strokeColor. */
  endDotColor?: string;
  /** SVG preserveAspectRatio. Дефолт 'none' — растяжение под контейнер. */
  preserveAspectRatio?: string;
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  strokeColor,
  strokeWidth = 2.2,
  endDot = false,
  endDotRadius,
  endDotColor,
  preserveAspectRatio = "none",
}: SparklineProps) {
  const { tokens } = useTheme();
  const stroke = strokeColor ?? tokens.accent;

  const n = values.length;
  if (n < 2) {
    // Нечего рисовать — возвращаем пустой SVG-бокс, чтобы разметка не «прыгала».
    return <View style={{ width, height }} />;
  }

  const padX = strokeWidth;
  const padY = strokeWidth;
  const usableW = Math.max(0, width - 2 * padX);
  const usableH = Math.max(0, height - 2 * padY);

  let minV = values[0]!;
  let maxV = values[0]!;
  for (let i = 1; i < n; i++) {
    const v = values[i]!;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const range = maxV - minV;

  const points: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = padX + (usableW * i) / (n - 1);
    const t = range === 0 ? 0.5 : (values[i]! - minV) / range;
    const y = padY + (1 - t) * usableH;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  const last = points[points.length - 1]!.split(",");
  const lastX = parseFloat(last[0]!);
  const lastY = parseFloat(last[1]!);

  return (
    <View>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={preserveAspectRatio}
      >
        <Polyline
          points={points.join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {endDot ? (
          <Circle
            cx={lastX}
            cy={lastY}
            r={endDotRadius ?? strokeWidth * 1.6}
            fill={endDotColor ?? stroke}
          />
        ) : null}
      </Svg>
    </View>
  );
}
