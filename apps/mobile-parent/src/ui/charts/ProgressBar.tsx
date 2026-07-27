/**
 * ProgressBar — линейная полоса прогресса, чистый RN (без SVG).
 * Перенос из макета «SNR EduOS v2 Light.dc.html»:
 *  - §s5 «Библиотека»: 5.5px, gap 7, цвет предмета (строка 2749: «Матем.»/«Англ.»).
 *  - Экран #11 «Детали предмета», «Освоение тем»: 5.5px без градиента (строка 474+).
 *  - П10 «Успехи», карточка «Посещаемость» на градиентной плитке: 4px, белый
 *    на .3-белом (строка 287).
 *  - Экран прогресса до уровня и др.: 3.5px для мини-баров.
 *
 * Сделано на RN <View> с absolute-заливкой; overflow:'hidden' + borderRadius
 * гарантируют скруглённые концы заполнения. Это стандартный приём макета —
 * SVG не нужен.
 *
 * Значение принимается либо как pct (0..1), либо как «сырое» value/max
 * (тогда pct считается на месте). В обеих темах трек и заливка задаются через
 * props; если fillColor/fillGradient не передан — берётся акцент темы.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
// StyleSheet используется для create(); absolute-fill задан вручную через
// styles.fill — часть типов RN в этом проекте не признаёт StyleSheet.absoluteFillObject.
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";
import { fonts, gradPoints } from "../../theme/tokens";

export interface ProgressBarProps {
  /** Значение как pct (0..1). Игнорируется, если задан value + max. */
  pct?: number;
  /** Альтернативно: сырое значение + максимум. */
  value?: number;
  max?: number;
  /** Высота полосы в px. Дефолт 5.5 (макет §s5, #11). Для мини — 3.5, для П10 — 4. */
  height?: number;
  /** Цвет трека. Дефолт под тему (ink3-like на светлом стекле). */
  trackColor?: string;
  /** Одноцветная заливка. Игнорируется, если задан fillGradient. */
  fillColor?: string;
  /** Двухцветный градиент 90° (слева-направо), напр. tokens.subjects.math.grad. */
  fillGradient?: [string, string];
  /** Радиус скругления, px. Дефолт height/2. */
  radius?: number;
  /**
   * Куда показать value-лейбл рядом с полосой:
   *  - 'right' — справа за полосой (макет §s5 «96% / 4.8», строка 2749);
   *  - 'inline' — поверх правого края полосы;
   *  - 'none' — не показывать.
   */
  showValueLabel?: "right" | "inline" | "none";
  /** Кастомная строка value-лейбла. По умолчанию — Math.round(pct*100)+'%'. */
  valueLabelText?: string;
  /** Цвет value-лейбла. Дефолт tokens.ink1. */
  valueLabelColor?: string;
  /** Дополнительный React-узел слева от полосы (например, label предмета). */
  leadingSlot?: ReactNode;
  /** Дополнительный стиль обёртки. */
  style?: ViewStyle;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function ProgressBar({
  pct,
  value,
  max,
  height = 5.5,
  trackColor,
  fillColor,
  fillGradient,
  radius,
  showValueLabel = "none",
  valueLabelText,
  valueLabelColor,
  leadingSlot,
  style,
}: ProgressBarProps) {
  const { tokens } = useTheme();

  const ratio = clamp01(
    typeof pct === "number"
      ? pct
      : typeof value === "number" && typeof max === "number" && max > 0
        ? value / max
        : 0,
  );

  const track =
    trackColor ??
    (tokens.scheme === "light" ? "rgba(23,18,67,0.09)" : "rgba(255,255,255,0.12)");
  const solidFill = fillColor ?? tokens.accent;
  const labelColor = valueLabelColor ?? tokens.ink1;
  const r = radius ?? height / 2;

  const grad = fillGradient
    ? gradPoints(90) // 90° — «слева направо»; в макете именно так у subject-баров.
    : null;

  const label = valueLabelText ?? `${Math.round(ratio * 100)}%`;

  return (
    <View style={[styles.row, style]}>
      {leadingSlot ? <View style={styles.leading}>{leadingSlot}</View> : null}

      <View
        style={[
          styles.track,
          {
            height,
            borderRadius: r,
            backgroundColor: track,
          },
        ]}
      >
        {fillGradient && grad ? (
          <LinearGradient
            colors={[fillGradient[0], fillGradient[1]]}
            start={grad.start}
            end={grad.end}
            style={[styles.fill, { width: `${ratio * 100}%`, borderRadius: r }]}
          />
        ) : (
          <View
            style={[
              styles.fill,
              {
                width: `${ratio * 100}%`,
                borderRadius: r,
                backgroundColor: solidFill,
              },
            ]}
          />
        )}

        {showValueLabel === "inline" ? (
          <View pointerEvents="none" style={styles.inlineLabelWrap}>
            <Text
              style={{
                color: labelColor,
                fontFamily: fonts.manrope800,
                fontSize: 10,
              }}
            >
              {label}
            </Text>
          </View>
        ) : null}
      </View>

      {showValueLabel === "right" ? (
        <Text
          style={{
            marginLeft: 8,
            color: labelColor,
            fontFamily: fonts.manrope800,
            fontSize: 11.5,
            textAlign: "right",
            minWidth: 34,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  leading: {
    flexShrink: 0,
  },
  track: {
    flex: 1,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },
  inlineLabelWrap: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
