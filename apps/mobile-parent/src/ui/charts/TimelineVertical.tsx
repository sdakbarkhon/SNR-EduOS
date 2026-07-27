/**
 * TimelineVertical — вертикальный таймлайн остановок (Транспорт).
 *
 * Референс макета «SNR EduOS v2 Light.dc.html»:
 *   • экран «Транспорт», список остановок — строки 1713–1715 (sc-for trStops),
 *   • JS-сборка узлов и коннекторов — строки 4124–4135 (метод trStops):
 *       past → зелёный круг 16×16 с галочкой + линия #10B981 flex:1 minHeight 16,
 *       now  → 18×18 оранжевый градиент #fbbf24→#f97316 с внешним «свечением»
 *              (box-shadow 0 0 0 2px + glow — RN эмуляция вложенным View),
 *       next/future → нейтральный 12×12 с рамкой ink.2 + линия ink.12,
 *   • подписи — right: label 11.5–12.5/800 + опциональный чип-подпись
 *              (chipEl «Ваша остановка» — не рисуем внутри компонента, отдаём
 *              строкой через props.chipLabel; оформление чипа — забота
 *              родительского узла или StatusChip).
 *
 * Компонент параметрический — принимает произвольный список остановок; толщина
 * коннектора и его минимальная высота настраиваются пропсами. Состояние 'now'
 * рендерится статичным двойным кольцом (без анимаций) — согласно бриле:
 * pulsing индикатор в этом заходе намеренно не делаем, только статический glow.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, useTheme } from "../../theme";

export type TimelineStopState = "past" | "now" | "next" | "future";

export interface TimelineVerticalStop {
  label: string;
  time?: string;
  state: TimelineStopState;
  /** Опциональная надпись «Ваша остановка» рядом с названием (макет строка 4134). */
  chipLabel?: string;
}

export interface TimelineVerticalProps {
  stops: TimelineVerticalStop[];
  /** Минимальная высота коннектора между узлами (макет minHeight 16). */
  connectorMinHeight?: number;
  /** Толщина коннектора (макет: 2.5). */
  connectorWidth?: number;
  /**
   * Градиент активного узла ('now'). По умолчанию — тот же оранжевый (fbbf24→f97316),
   * что в макете; можно перекрыть, например accent-gradient темы.
   */
  nowGradient?: [string, string];
  /**
   * Цвет ореола вокруг активного узла (макет box-shadow 0 0 12 rgba(249,115,22,.6)).
   * По умолчанию согласован с оранжевым nowGradient; при передаче другого
   * градиента ореол пересчитывать явно через этот prop.
   */
  nowGlowColor?: string;
  /**
   * Цвет разделительного кольца между свечением и градиентом (в макете —
   * буквально `box-shadow 0 0 0 2px #fff`, читаемо на любом фоне). По умолчанию
   * белый в обеих темах.
   */
  nowRingColor?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_NOW_GRAD: [string, string] = ["#FBBF24", "#F97316"];
const DEFAULT_NOW_GLOW = "rgba(249,115,22,0.35)"; // согласован с DEFAULT_NOW_GRAD

export function TimelineVertical({
  stops,
  connectorMinHeight = 16,
  connectorWidth = 2.5,
  nowGradient = DEFAULT_NOW_GRAD,
  nowGlowColor = DEFAULT_NOW_GLOW,
  nowRingColor = "#FFFFFF",
  style,
}: TimelineVerticalProps) {
  const { tokens, scheme } = useTheme();
  const inkRgb = scheme === "dark" ? "255,255,255" : "23,18,67";

  const doneColor = `rgb(${tokens.status.green.rgb})`; // 16,185,129
  const dim = `rgba(${inkRgb},0.12)`;
  const dimBorder = `rgba(${inkRgb},0.2)`;
  const orangeText = tokens.status.orange.text;

  return (
    <View style={style}>
      {stops.map((s, i) => {
        const isLast = i === stops.length - 1;
        // Цвет коннектора — по состоянию текущего шага (макет строка 4131):
        // past → зелёный, иначе dim.
        const connectorColor = s.state === "past" ? doneColor : dim;
        // Цвета текста: past→ink, now→ink1 крупнее, next→ink.55; time аналогично.
        const nameColor =
          s.state === "next" || s.state === "future"
            ? `rgba(${inkRgb},0.55)`
            : tokens.ink1;
        const nameSize = s.state === "now" ? 12.5 : 11.5;
        const timeColor =
          s.state === "now"
            ? orangeText
            : s.state === "past"
              ? tokens.status.green.text
              : `rgba(${inkRgb},0.5)`;
        return (
          <View key={i} style={styles.row}>
            <View style={styles.gutter}>
              <Node
                state={s.state}
                doneColor={doneColor}
                nowGradient={nowGradient}
                nowGlowColor={nowGlowColor}
                nowRingColor={nowRingColor}
                dim={dim}
                dimBorder={dimBorder}
              />
              {isLast ? null : (
                <View
                  style={{
                    width: connectorWidth,
                    flexGrow: 1,
                    minHeight: connectorMinHeight,
                    borderRadius: 2,
                    backgroundColor: connectorColor,
                    marginVertical: 2,
                  }}
                />
              )}
            </View>
            <View style={[styles.content, { paddingBottom: isLast ? 0 : 14 }]}>
              <View style={styles.textCol}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: nameSize,
                    color: nameColor,
                  }}
                >
                  {s.label}
                </Text>
                {s.chipLabel ? (
                  <Text
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 4,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                      fontFamily: fonts.manrope800,
                      fontSize: 8,
                      color: tokens.status.violet.text,
                      backgroundColor: tokens.chip(tokens.status.violet.rgb).bg,
                      borderWidth: 1,
                      borderColor: tokens.chip(tokens.status.violet.rgb).border,
                      overflow: "hidden",
                    }}
                  >
                    {s.chipLabel}
                  </Text>
                ) : null}
              </View>
              {s.time ? (
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 10.5,
                    color: timeColor,
                  }}
                >
                  {s.time}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Node({
  state,
  doneColor,
  nowGradient,
  nowGlowColor,
  nowRingColor,
  dim,
  dimBorder,
}: {
  state: TimelineStopState;
  doneColor: string;
  nowGradient: [string, string];
  nowGlowColor: string;
  nowRingColor: string;
  dim: string;
  dimBorder: string;
}) {
  if (state === "past") {
    // 16×16 круг + галочка (макет строка 4126).
    return (
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: doneColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={9} height={9} viewBox="0 0 24 24">
          <Path
            d="M20 6 9 17l-5-5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
  if (state === "now") {
    // Двойное кольцо + градиент — эмуляция макетного
    // box-shadow: 0 0 0 2px #f97316, 0 0 12px rgba(249,115,22,.6);
    // внешний View — свечение (низкая альфа), средний — белое кольцо,
    // внутренний — градиентный кружок. Статический вариант, без пульсации.
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: nowGlowColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: nowRingColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={nowGradient}
            {...gradPoints(135)}
            style={{ width: 18, height: 18, borderRadius: 9 }}
          />
        </View>
      </View>
    );
  }
  // next / future — нейтральный 12×12 с рамкой (макет строка 4128).
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: dim,
        borderWidth: 2,
        borderColor: dimBorder,
        marginVertical: 2,
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  gutter: {
    width: 24,
    alignItems: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  textCol: {
    flex: 1,
    flexDirection: "column",
    gap: 2,
  },
});
