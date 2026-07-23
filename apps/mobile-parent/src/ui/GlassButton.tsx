/** Кнопка liquid-glass. primary — градиентная (акцент), secondary — стеклянная,
 *  ghost — прозрачная. Иконка (lucide) опциональна слева от подписи. */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { type LucideIcon } from "lucide-react-native";
import { AppText } from "./AppText";
import { GlassCard } from "./GlassCard";
import { fonts, gradients, palette, radii, shadows } from "./theme";

export type GlassButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GlassButton({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  fullWidth,
  disabled,
  style,
}: GlassButtonProps) {
  const content = (
    <View style={styles.row}>
      {Icon && <Icon size={18} color={variant === "ghost" ? palette.textMuted : palette.text} strokeWidth={2} />}
      <AppText
        style={{
          fontFamily: fonts.bold,
          fontSize: 15,
          color: variant === "ghost" ? palette.textMuted : palette.text,
        }}
      >
        {label}
      </AppText>
    </View>
  );

  if (variant === "primary") {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          shadows.glowViolet,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.primary]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === "secondary") {
    return (
      <GlassCard
        variant="elevated"
        radius={radii.pill}
        onPress={disabled ? undefined : onPress}
        style={[fullWidth && styles.fullWidth, disabled && styles.disabled, style]}
        contentStyle={styles.secondaryContent}
      >
        {content}
      </GlassCard>
    );
  }

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.ghost, fullWidth && styles.fullWidth, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primary: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
  },
  secondaryContent: { paddingVertical: 14, paddingHorizontal: 22, alignItems: "center" },
  ghost: { paddingVertical: 14, paddingHorizontal: 22, alignItems: "center" },
  fullWidth: { alignSelf: "stretch" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
