/**
 * InnerHeader — шапка внутренних экранов (со стрелкой «назад»).
 * Спека: «SNR EduOS v2 Light.dc.html», шапки внутренних экранов
 * (например Экран #8 «Уведомления», строки 687–690; П17-дети — строка ~380):
 *  row gap 12, padding 46 18 8; круглая стеклянная back-кнопка 38
 *  (160° W72→W46 + blur(18) + border W80, глиф-стрелка 18 stroke 2);
 *  заголовок Unbounded 15/600 flex 1 (на части экранов 16 — через prop);
 *  опциональный правый слот (иконки действий).
 * Тёмные пары: стекло — glass1 dark (CSS 28, 56), глиф/заголовок — ink1.
 * paddingTop — max(safe-area, 46). Presentational: всё через props.
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "../theme";
import { GlassCircleButton } from "./RootHeader";

export interface InnerHeaderProps {
  title: string;
  /** Размер заголовка Unbounded 600: 15 (строка 689) или 16 (часть экранов). */
  titleSize?: 15 | 16;
  onBackPress?: () => void;
  /** Правый слот (кнопки действий). */
  right?: ReactNode;
}

export function InnerHeader({
  title,
  titleSize = 15,
  onBackPress,
  right,
}: InnerHeaderProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingTop: Math.max(insets.top, 46),
        paddingHorizontal: 18,
        paddingBottom: 8,
      }}
    >
      <GlassCircleButton onPress={onBackPress}>
        {/* Стрелка «назад» 18 stroke 2 (строка 688). */}
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={tokens.ink1}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M19 12H5" />
          <Path d="m12 19-7-7 7-7" />
        </Svg>
      </GlassCircleButton>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonts.unbounded600,
          fontSize: titleSize,
          color: tokens.ink1,
        }}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
