/** Текст с пресетами типографики (Manrope/Unbounded). Гарантирует, что все
 *  надписи используют загруженные шрифты дизайна, а не системный. */
import { Text, type TextProps } from "react-native";
import { typography } from "./theme";

export type TextPreset = keyof typeof typography;

export function AppText({
  preset = "body",
  style,
  ...rest
}: TextProps & { preset?: TextPreset }) {
  return <Text {...rest} style={[typography[preset], style]} />;
}
