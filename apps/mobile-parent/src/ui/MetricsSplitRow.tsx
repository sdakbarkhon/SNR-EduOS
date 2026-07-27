/**
 * MetricsSplitRow — метрики-сплит карточки ребёнка, перенос 1:1 из макета
 * «SNR EduOS v2 Light.dc.html», П5 Dashboard (строки 230–239):
 *   ряд gap 6, опц. верхний разделитель padding-top 10 + border-top 1px rgba(23,18,67,.08);
 *   вертикальные разделители 1px rgba(23,18,67,.08);
 *   ячейка: колонка center gap 1; caps-лейбл 8/800 ls .05em rgba(26,19,74,.5);
 *   значение 12/800 #171243 (или цвет из props: #047857, #c2410c — строки 235, 237).
 * Тёмные пары — CSS-оверрайды: строка 113 (фон .08 → W12), строка 127 (border-top → W11),
 * строка 87 (текст .5 → W55).
 */
import { View, Text } from "react-native";
import { useTheme, fonts } from "../theme";

/** Разделители rgba(23,18,67,.08): тёмная пара — CSS строка 113. */
const SEPARATOR = { light: "rgba(23,18,67,0.08)", dark: "rgba(255,255,255,0.12)" };
/** border-top rgba(23,18,67,.08): тёмная пара — CSS строка 127. */
const TOP_BORDER = { light: "rgba(23,18,67,0.08)", dark: "rgba(255,255,255,0.11)" };
/** Caps-лейбл rgba(26,19,74,.5): тёмная пара — CSS строка 87. */
const LABEL = { light: "rgba(26,19,74,0.5)", dark: "rgba(255,255,255,0.55)" };

export interface MetricCell {
  /** Caps-лейбл (8/800, uppercase). */
  label: string;
  /** Значение (12/800). */
  value: string;
  /** Цвет значения; по умолчанию ink1 (макет: #047857 / #c2410c для акцентов). */
  valueColor?: string;
  /** Вес ячейки (макет: последняя ячейка кошелька flex 1.4, строка 239). */
  flex?: number;
}

export interface MetricsSplitRowProps {
  cells: MetricCell[];
  /** Верхний разделитель: padding-top 10 + border-top (строка 230). */
  topDivider?: boolean;
}

export function MetricsSplitRow({ cells, topDivider = false }: MetricsSplitRowProps) {
  const { tokens, scheme } = useTheme();

  return (
    <View
      style={[
        { flexDirection: "row", gap: 6 },
        topDivider && {
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: TOP_BORDER[scheme],
        },
      ]}
    >
      {cells.map((cell, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 6, flex: cell.flex ?? 1 }}>
          {i > 0 ? (
            <View style={{ width: 1, backgroundColor: SEPARATOR[scheme] }} />
          ) : null}
          <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 8,
                letterSpacing: 8 * 0.05,
                textTransform: "uppercase",
                color: LABEL[scheme],
              }}
            >
              {cell.label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: cell.valueColor ?? tokens.ink1,
              }}
            >
              {cell.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
