/** Поле ввода на стекле: иконка (lucide) + TextInput. Плейсхолдер и текст —
 *  в палитре тёмной темы, шрифт Manrope. */
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import { GlassCard } from "./GlassCard";
import { fonts, palette, radii } from "./theme";

export type GlassInputProps = TextInputProps & {
  icon?: LucideIcon;
  containerStyle?: StyleProp<ViewStyle>;
};

export function GlassInput({ icon: Icon, containerStyle, style, ...rest }: GlassInputProps) {
  return (
    <GlassCard variant="std" radius={radii.lg} style={containerStyle} contentStyle={styles.content}>
      {Icon && <Icon size={18} color={palette.textMuted} strokeWidth={2} />}
      <TextInput
        placeholderTextColor={palette.textDim}
        style={[styles.input, style]}
        {...rest}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: palette.text, padding: 0 },
});
