/**
 * ListRow — универсальная строка списка 52–60px, перенос 1:1 из макета
 * «SNR EduOS v2 Light.dc.html»:
 *   §s7 «Строка списка» (строка 2771): row gap 10, плитка слева, title 12/800,
 *   sub 10/600 rgba(26,19,74,.62), правый слот, шеврон 14 stroke rgba(26,19,74,.4);
 *   строки Dashboard/счетов/истории (строки 266–268): padding 10px 0, gap 11,
 *   title 12.5/800, sub 10.5/600, разделитель border-top 1px rgba(23,18,67,.07).
 * Тёмные пары — CSS-оверрайды: строка 126 (border-top .07 → W10),
 * строка 91 (шеврон .4 → W42).
 */
import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme, fonts } from "../theme";

/** Разделитель border-top 1px rgba(23,18,67,.07): тёмная пара — CSS строка 126. */
const DIVIDER = { light: "rgba(23,18,67,0.07)", dark: "rgba(255,255,255,0.1)" };
/** Шеврон rgba(26,19,74,.4): тёмная пара — CSS строка 91. */
const CHEVRON = { light: "rgba(26,19,74,0.4)", dark: "rgba(255,255,255,0.42)" };

export interface ListRowProps {
  /** Левый слот: плитка предмета / аватар / иконка. */
  left?: ReactNode;
  /** Заголовок 12.5/800 ink1. */
  title: string;
  /** Подпись 10.5/600 ink2 (.62 в макете). */
  subtitle?: string;
  /** Правый слот: чип / оценка / бейдж. */
  right?: ReactNode;
  /** Шеврон › справа (14px, ink3(.4)). */
  chevron?: boolean;
  /** Разделитель сверху 1px (строка 267). */
  divider?: boolean;
  /** Вертикальный padding строки (макет: 10 → высота 52–60). */
  verticalPadding?: number;
  /** Зазор между блоками (макет: 11 на экранах, 10 в §s7). */
  gap?: number;
  onPress?: () => void;
}

export function ListRow({
  left,
  title,
  subtitle,
  right,
  chevron = false,
  divider = false,
  verticalPadding = 10,
  gap = 11,
  onPress,
}: ListRowProps) {
  const { tokens, scheme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap,
          paddingVertical: verticalPadding,
        },
        divider && { borderTopWidth: 1, borderTopColor: DIVIDER[scheme] },
      ]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="m9 18 6-6-6-6"
            stroke={CHEVRON[scheme]}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}
