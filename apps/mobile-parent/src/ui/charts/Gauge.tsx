/**
 * Gauge — параметрический полукруговой спидометр.
 * Перенос из макета «SNR EduOS v2 Light.dc.html»:
 *  - §s5 «Библиотека» — виджет-плитка спидометр (строка 2746, size≈92×54)
 *  - Экран #11 «Детали предмета» — крупный 110×66 на градиенте (строка 470)
 *  - #16 «Навыки» — вариант в стиле экрана деталей
 *  - «Сводка 3-в-1» — мини 62×38 в градиентной карточке (строки 2736–2737)
 *
 * Внутренний viewBox нормализован в «120 × 70», cx=60, cy=62, R=48, thickness=10.
 * Внешний размер (`size`) — только визуальный масштаб; параметры (толщина, шрифт
 * label-а) заданы в тех же viewBox-единицах, чтобы дуга и текст масштабировались
 * одновременно.
 *
 * Полярная математика (SVG y-down):
 *   Полудуга по верху от (cx-R, cy) до (cx+R, cy), sweep-flag = 1.
 *   Пусть pct = clamp(value / max, 0, 1). Точка на дуге при пройденной доле pct
 *   имеет математический угол θ = π · (1 − pct) от +x-оси. В SVG-координатах:
 *     end.x = cx − R · cos(π · pct)
 *     end.y = cy − R · sin(π · pct)
 *   Проверки: pct=0 → (cx−R, cy); pct=0.5 → (cx, cy−R); pct=1 → (cx+R, cy).
 *
 * Шрифт центрального лейбла: react-native-svg <Text>. Выбор — чтобы шрифт был
 * внутри SVG-координатной системы и масштабировался вместе с дугой; RN-<Text>
 * абсолютом потребовал бы пересчёта размера при каждом изменении внешнего `size`.
 */
import { View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme";
import { fonts } from "../../theme/tokens";

const CX = 60;
const CY = 62;
const R = 48;

export interface GaugeProps {
  /** Текущее значение (0..max). */
  value: number;
  /** Максимум шкалы. По умолчанию 100 — для процентов; для «4.7 / 5.0» передавайте max=5. */
  max?: number;
  /** Внешняя ширина. Высота считается как size * 70/120. Дефолт 110 — как #11. */
  size?: number;
  /** Толщина дуги в viewBox-единицах. Дефолт 10 (макет: 10 для крупных, 6 для мини 62×38). */
  thickness?: number;
  /** Цвет фоновой дуги. */
  trackColor?: string;
  /** Цвет заполненной дуги. */
  fillColor?: string;
  /** Центральный текст (например «4.7» или «96%»). */
  centerLabel?: string;
  /** Цвет центрального текста. По умолчанию tokens.ink1. */
  centerLabelColor?: string;
  /** Размер центрального текста в viewBox-единицах. Дефолт 17 (макет §s5). */
  centerLabelSize?: number;
  /** Y-координата базовой линии текста в viewBox-единицах. Дефолт 58. */
  centerLabelY?: number;
}

export function Gauge({
  value,
  max = 100,
  size = 110,
  thickness = 10,
  trackColor,
  fillColor,
  centerLabel,
  centerLabelColor,
  centerLabelSize = 17,
  centerLabelY = 58,
}: GaugeProps) {
  const { tokens } = useTheme();
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const endX = CX - R * Math.cos(Math.PI * pct);
  const endY = CY - R * Math.sin(Math.PI * pct);

  // Дефолтные цвета: track — ink3-like на стекле; fill — акцент темы.
  const track =
    trackColor ??
    (tokens.scheme === "light" ? "rgba(23,18,67,0.10)" : "rgba(255,255,255,0.14)");
  const fill = fillColor ?? tokens.accent;
  const labelColor = centerLabelColor ?? tokens.ink1;

  const trackPath = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const fillPath = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;

  const height = size * (70 / 120);

  return (
    <View>
      <Svg width={size} height={height} viewBox="0 0 120 70">
        <Path
          d={trackPath}
          fill="none"
          stroke={track}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {pct > 0 ? (
          <Path
            d={fillPath}
            fill="none"
            stroke={fill}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        ) : null}
        {centerLabel ? (
          <SvgText
            x={CX}
            y={centerLabelY}
            textAnchor="middle"
            fontFamily={fonts.manrope800}
            fontSize={centerLabelSize}
            fontWeight="800"
            fill={labelColor}
          >
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
