/**
 * SectionHeader — caps-заголовок секции с опциональной правой ссылкой.
 * Спека: «SNR EduOS v2 Light.dc.html», «Библиотека» §s7 (строка 2772
 * «СЕКЦИЯ С ЗАГОЛОВКОМ» + «Смотреть все ›») и типовое использование
 * на экранах (например строка 387): заголовок 10.5/800, letter-spacing .08em,
 * uppercase, цвет rgba(26,19,74,.5); ссылка 11.5/800 акцентом #6D28D9
 * (= tokens.status.violet.text; тёмная пара #C4B5FD — CSS строка 99).
 * Presentational: тексты только через props, тема — useTheme().
 */
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { fonts, useTheme } from "../theme";

export interface SectionHeaderProps {
  title: string;
  /** Текст правой ссылки (например «Смотреть все ›»); без него ссылки нет. */
  linkLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Цвет заголовка: светлая rgba(26,19,74,.5) (строка 2772); тёмная — CSS строка 88 (.5 → W55). */
const TITLE_COLOR = {
  light: "rgba(26,19,74,0.5)",
  dark: "rgba(255,255,255,0.55)",
};

export function SectionHeader({ title, linkLabel, onPress, style }: SectionHeaderProps) {
  const { tokens, scheme } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: TITLE_COLOR[scheme] }]}>{title}</Text>
      {linkLabel ? (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text style={[styles.link, { color: tokens.status.violet.text }]}>
            {linkLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.manrope800,
    fontSize: 10.5,
    // .08em при 10.5px ≈ 0.84.
    letterSpacing: 0.84,
    textTransform: "uppercase",
  },
  link: {
    fontFamily: fonts.manrope800,
    fontSize: 11.5,
  },
});
