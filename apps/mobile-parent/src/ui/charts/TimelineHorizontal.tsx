/**
 * TimelineHorizontal — горизонтальный таймлайн статуса задания.
 *
 * Референс макета «SNR EduOS v2 Light.dc.html»:
 *   • экран #13 «Детали задания», статус-полоса — строка 571
 *     (узел 18px круг, коннектор высотой 2.5, состояния done/current/upcoming;
 *     current = rgba(124,58,237,.25) + border 2.5px #7c3aed);
 *   • подписи узлов — строка 572 (label 9/800, дата 8/600 у ink.5,
 *     выравнивание: 1-й flex-start, последний flex-end, средние center);
 *   • компактная версия из «Библиотеки» §s5 — строка 2753 (узлы 16px, коннектор 2).
 *
 * Компонент параметрический — принимает произвольный список шагов; геометрия
 * коннектора между узлами считается через flex:1 (эквивалент «занять всё
 * оставшееся»). Свои узлы для каждого состояния — отдельная константа,
 * фильтры по статусу — единственная логика в render.
 *
 * Цвет коннектора: строка 571 — если следующий шаг ещё не done, коннектор
 * приглушённый (ink .12), иначе green. Проверено на макете #13 (4 узла):
 * done→done→done→current, коннекторы: green, green, dim.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, useTheme } from "../../theme";

export type TimelineStepState = "done" | "current" | "upcoming";

export interface TimelineHorizontalStep {
  label: string;
  date?: string;
  state: TimelineStepState;
}

export interface TimelineHorizontalProps {
  steps: TimelineHorizontalStep[];
  /** Размер узла-круга (макет: 18 на #13, 16 в компактной §s5). */
  nodeSize?: number;
  /** Толщина коннектора (макет: 2.5 / 2). */
  connectorHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export function TimelineHorizontal({
  steps,
  nodeSize = 18,
  connectorHeight = 2.5,
  style,
}: TimelineHorizontalProps) {
  const { tokens, scheme } = useTheme();
  const inkRgb = scheme === "dark" ? "255,255,255" : "23,18,67";

  // Цвета семей — из макета: done=#10B981; current=accent (у нас tokens.accent).
  const doneColor = `rgb(${tokens.status.green.rgb})`; // 16,185,129
  const currentAccent = tokens.accent; // #7C3AED / dark #8B5CF6
  // Приглушённый — ink.12 (макет строка 571 «rgba(23,18,67,.12)»).
  const dim = `rgba(${inkRgb},0.12)`;

  return (
    <View style={style}>
      {/*
        Полоса с узлами и коннекторами — рендерится плоской последовательностью
        [Node, Connector, Node, Connector, ..., Node]. Как в макете:
        span(width:18, flex-shrink:0), span(flex:1, height:2.5) — прямые дети
        одного flex-row. Обёртка stepGroup не подходит, потому что flex:1 у
        коннектора внутри группы отсчитывается от группы, а не от контейнера.
      */}
      <View style={[styles.bar, { paddingHorizontal: 4 }]}>
        {steps.flatMap((s, i) => {
          const next = steps[i + 1];
          const connectorColor =
            s.state === "done" && next?.state === "done" ? doneColor : dim;
          const nodeEl = (
            <Node
              key={`n${i}`}
              state={s.state}
              size={nodeSize}
              doneColor={doneColor}
              accent={currentAccent}
              dim={dim}
            />
          );
          if (i === steps.length - 1) return [nodeEl];
          return [
            nodeEl,
            <View
              key={`c${i}`}
              style={{
                flex: 1,
                height: connectorHeight,
                backgroundColor: connectorColor,
              }}
            />,
          ];
        })}
      </View>
      {/* Подписи: label + опционально дата. */}
      <View style={[styles.labels, { paddingHorizontal: 2 }]}>
        {steps.map((s, i) => {
          const align =
            i === 0 ? "flex-start" : i === steps.length - 1 ? "flex-end" : "center";
          const labelColor =
            s.state === "done"
              ? tokens.status.green.text
              : s.state === "current"
                ? tokens.status.violet.text
                : `rgba(${inkRgb},0.55)`;
          return (
            <View key={i} style={[styles.labelCol, { alignItems: align }]}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 9,
                  color: labelColor,
                }}
              >
                {s.label}
              </Text>
              {s.date ? (
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 8,
                    color: `rgba(${inkRgb},0.5)`,
                  }}
                >
                  {s.date}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Node({
  state,
  size,
  doneColor,
  accent,
  dim,
}: {
  state: TimelineStepState;
  size: number;
  doneColor: string;
  accent: string;
  dim: string;
}) {
  const r = size / 2;
  if (state === "done") {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: doneColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Галочка — макет: 10×10, stroke #fff, width 3.2 (строка 571). */}
        <Svg width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} viewBox="0 0 24 24">
          <Path
            d="M20 6 9 17l-5-5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
  if (state === "current") {
    // Заливка rgba(124,58,237,.25) + border 2.5px accent (макет строка 571).
    // Используем tokens.accent как base — конвертируем в rgba через альфу-подложку.
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: 2.5,
          borderColor: accent,
          backgroundColor: withAlpha(accent, 0.25),
        }}
      />
    );
  }
  // upcoming — простой dim-круг.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: dim,
      }}
    />
  );
}

/**
 * Наложение альфы на HEX. Только для tokens.accent (гарантированно #RRGGBB).
 * Не универсальный helper — вынесен внутрь, чтобы не тащить в общий theme layer.
 */
function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  labelCol: {
    flexDirection: "column",
    flex: 1,
  },
});
