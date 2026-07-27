/**
 * SubjectTile — плитка предмета: белый глиф на градиенте предмета.
 * Спека: «SNR EduOS v2 Light.dc.html», «Библиотека» §s1 (строки 2677–2687:
 * плитка 40 r13, градиент 135° из палитры предметов, цветная тень
 * 0 8 18 rgba(цвет,.3….32) ≈ токен sh-color) и §s2 (строки 2688–2701:
 * «глиф всегда белый на цветной градиентной плитке 36–46px r12–14
 * с тенью в цвете плитки»). Текстовые глифы («√x», «Aa») — 14/800 белым
 * при 40–42px (строки 2679, 2680).
 * Цвета — только tokens.subjects[subjectId]; тёмная тень — glow tokens.shColor.
 * Presentational: глиф через children/glyph, тема — useTheme().
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, shadowStyle, useTheme, type ThemeTokens } from "../theme";

export type SubjectId = keyof ThemeTokens["subjects"];

export interface SubjectTileProps {
  subjectId: SubjectId;
  /** Размер плитки 36–46 (по умолчанию 40 — §s1). */
  size?: number;
  /** Радиус r12–14 (по умолчанию 13 — §s1). */
  radius?: number;
  /** Текстовый глиф («√x», «Aa») — если нет SVG-иконки. */
  glyph?: string;
  /** Белый SVG-глиф (react-native-svg) — приоритетнее glyph. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** #RRGGBB → «R,G,B» для rgba()-теней (цвет тени = тёмный стоп градиента, §s1). */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function SubjectTile({
  subjectId,
  size = 40,
  radius = 13,
  glyph,
  children,
  style,
}: SubjectTileProps) {
  const { tokens } = useTheme();
  const subject = tokens.subjects[subjectId];
  const shadow = tokens.shColor(hexToRgb(subject.grad[1]));

  return (
    <LinearGradient
      colors={subject.grad}
      {...gradPoints(135)}
      style={[
        styles.tile,
        shadowStyle(shadow),
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      {children ?? (glyph ? <Text style={styles.glyph}>{glyph}</Text> : null)}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  glyph: {
    fontFamily: fonts.manrope800,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
