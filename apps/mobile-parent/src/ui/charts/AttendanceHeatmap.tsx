/**
 * AttendanceHeatmap — календарь-хитмап посещаемости для экрана #14 «Посещаемость».
 *
 * Референс макета «SNR EduOS v2 Light.dc.html»:
 *   • сетка ячеек и заголовки — строки 603–606
 *     (grid-template-columns: repeat(7,1fr); gap: 4; ячейка: height 26, r8, шрифт 10/800);
 *   • семьи цветов ячеек — метод attCells(), строки 3807–3828
 *     (p green .72 / u orange .78 / n red .78 / w ink.05 / f ink.08 / t accent-gradient
 *     + двойное кольцо box-shadow 0 0 0 2px #fff, 0 0 0 3.5px #7c3aed);
 *   • легенда — строки 607–612 (квадраты 8×8 r3 + подпись 9/700 для каждой семьи).
 *
 * Компонент параметрический: получает 35 кодов ячеек и внутренне считает номер
 * дня месяца (аналогично attCells: счётчик, инкрементируется для не-'e' ячейки).
 * Реализация «двойного кольца» под «сегодня» — вложенные View-кольца, потому что
 * RN не поддерживает многослойные box-shadow (см. отчёт про Android/elevation в
 * бриле группы: тени SVG на Android — известное ограничение платформы).
 *
 * Grid — не через CSS grid (в RN его нет), а через 5 рядов flex-row, каждая
 * ячейка `flex: 1`, height 26 — эквивалент repeat(7,1fr). Локали дней недели
 * передаются пропсом (для i18n) или используются дефолтные Пн–Вс.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, useTheme } from "../../theme";
import type { AttendanceCellCode } from "../../data/types";

/** Семьи ячеек — те же, что в макете, отдельная константа для легенды. */
export const ATTENDANCE_LEGEND_FAMILIES = ["p", "u", "n", "w"] as const;
export type AttendanceLegendFamily = (typeof ATTENDANCE_LEGEND_FAMILIES)[number];

export interface AttendanceHeatmapProps {
  /** 35 кодов Пн–Вс подряд. `e` — пустая (точка «·»). */
  cells: AttendanceCellCode[];
  /** Локализованные короткие имена дней. По умолчанию Пн Вт Ср Чт Пт Сб Вс. */
  weekdays?: readonly [string, string, string, string, string, string, string];
  /** Зазор между ячейками (макет: 4). */
  gap?: number;
  /** Высота ячейки (макет: 26). */
  cellHeight?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function AttendanceHeatmap({
  cells,
  weekdays = DEFAULT_WEEKDAYS,
  gap = 4,
  cellHeight = 26,
  style,
}: AttendanceHeatmapProps) {
  const { tokens, scheme } = useTheme();

  // Номера дней — счётчик, как в attCells (строка 3822): d++ для каждой не-'e'.
  const days: (number | null)[] = [];
  let d = 0;
  for (let i = 0; i < 35; i++) {
    const c = cells[i] ?? "e";
    if (c === "e") days.push(null);
    else {
      d += 1;
      days.push(d);
    }
  }

  const rows: number[][] = [];
  for (let r = 0; r < 5; r++) rows.push([0, 1, 2, 3, 4, 5, 6].map((k) => r * 7 + k));

  const weekdayColor = tokens.ink3; // «rgba(26,19,74,.45)» / светлая-45 из макета строка 604.

  return (
    <View style={style}>
      {/* Шапка недели. */}
      <View style={[styles.row, { gap, marginBottom: gap }]}>
        {weekdays.map((w) => (
          <Text
            key={w}
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: fonts.manrope800,
              fontSize: 8.5,
              color: weekdayColor,
            }}
          >
            {w}
          </Text>
        ))}
      </View>
      {/* 5 рядов × 7 ячеек. */}
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.row, { gap, marginTop: ri === 0 ? 0 : gap }]}>
          {row.map((idx) => {
            const code = (cells[idx] ?? "e") as AttendanceCellCode;
            const dayNo = days[idx];
            return (
              <Cell
                key={idx}
                code={code}
                dayNo={dayNo}
                height={cellHeight}
                scheme={scheme}
                inkRgb={scheme === "dark" ? "255,255,255" : "23,18,67"}
                accentGrad={tokens.accentGrad.colors as [string, string]}
                accent={tokens.accent}
                ink3={tokens.ink3}
                greenRgb={tokens.status.green.rgb}
                orangeRgb={tokens.status.orange.rgb}
                redRgb={tokens.status.red.rgb}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Легенда четырёх семей (p / u / n / w+f) — макет строки 607–612. */
export interface AttendanceHeatmapLegendProps {
  items?: readonly { code: AttendanceLegendFamily; label: string }[];
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_LEGEND: readonly { code: AttendanceLegendFamily; label: string }[] = [
  { code: "p", label: "Присутствовал" },
  { code: "u", label: "Уважительная" },
  { code: "n", label: "Без уважительной" },
  { code: "w", label: "Выходной / будущие" },
];

export function AttendanceHeatmapLegend({
  items = DEFAULT_LEGEND,
  style,
}: AttendanceHeatmapLegendProps) {
  const { tokens, scheme } = useTheme();
  const inkRgb = scheme === "dark" ? "255,255,255" : "23,18,67";
  const swatchFor = (code: AttendanceLegendFamily): string => {
    switch (code) {
      case "p":
        return `rgba(${tokens.status.green.rgb},0.75)`;
      case "u":
        return `rgba(${tokens.status.orange.rgb},0.8)`;
      case "n":
        return `rgba(${tokens.status.red.rgb},0.8)`;
      case "w":
        return `rgba(${inkRgb},0.08)`;
    }
  };
  return (
    <View style={[styles.legend, style]}>
      {items.map((it) => (
        <View key={it.code} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: swatchFor(it.code) }]} />
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 9,
              color: `rgba(${inkRgb},0.62)`,
            }}
          >
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Одна ячейка календаря. Отдельный компонент — чтобы не «пятнать» тело grid. */
function Cell({
  code,
  dayNo,
  height,
  scheme,
  inkRgb,
  accentGrad,
  accent,
  ink3,
  greenRgb,
  orangeRgb,
  redRgb,
}: {
  code: AttendanceCellCode;
  dayNo: number | null;
  height: number;
  scheme: "light" | "dark";
  inkRgb: string;
  accentGrad: [string, string];
  accent: string;
  ink3: string;
  greenRgb: string;
  orangeRgb: string;
  redRgb: string;
}) {
  // Пустая («·») — прозрачная, только точка-подсказка выравнивания.
  if (code === "e") {
    return (
      <View style={[styles.cell, { height, backgroundColor: "transparent" }]}>
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10,
            color: "transparent",
          }}
        >
          ·
        </Text>
      </View>
    );
  }

  // «Сегодня» — accent-gradient + двойное кольцо (эмуляция box-shadow макета
  // 0 0 0 2px #fff, 0 0 0 3.5px #7c3aed через два вложенных View-кольца).
  if (code === "t") {
    return (
      <View style={[styles.cell, { height, backgroundColor: "transparent" }]}>
        <View
          style={[
            styles.ringOuter,
            { borderColor: accent, backgroundColor: accent },
          ]}
        >
          <View
            style={[
              styles.ringInner,
              // Белый разделитель в обеих темах: в макете это буквально
              // «box-shadow 0 0 0 2px #fff» — на любом фоне даёт двойное
              // кольцо. В dark контраст сохраняется (белая линия читается
              // и на glass-фоне, и на accent-градиенте).
              { borderColor: "#FFFFFF" },
            ]}
          >
            <LinearGradient
              colors={accentGrad}
              {...gradPoints(135)}
              style={styles.todayFill}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  color: "#FFFFFF",
                }}
              >
                {dayNo}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    );
  }

  // Прочие семьи — фон rgba(семья, α) из tokens.status.*, чтобы правка
  // токенов синхронно применялась и к легенде, и к календарю.
  const map: Record<
    Exclude<AttendanceCellCode, "e" | "t">,
    { bg: string; color: string }
  > = {
    p: { bg: `rgba(${greenRgb},0.72)`, color: "#FFFFFF" },
    u: { bg: `rgba(${orangeRgb},0.78)`, color: "#FFFFFF" },
    n: { bg: `rgba(${redRgb},0.78)`, color: "#FFFFFF" },
    w: { bg: `rgba(${inkRgb},0.05)`, color: ink3 },
    f: { bg: `rgba(${inkRgb},0.08)`, color: ink3 },
  };
  const { bg, color } = map[code as Exclude<AttendanceCellCode, "e" | "t">];
  return (
    <View style={[styles.cell, { height, backgroundColor: bg }]}>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 10,
          color,
        }}
      >
        {dayNo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 0,
  },
  ringInner: {
    flex: 1,
    borderRadius: 6.5,
    borderWidth: 2,
    overflow: "hidden",
  },
  todayFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 3,
  },
});
