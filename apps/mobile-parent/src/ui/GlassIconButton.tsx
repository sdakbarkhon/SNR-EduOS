/** Круглая стеклянная кнопка-иконка (назад, колокольчик, меню и т.п.). */
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type LucideIcon } from "lucide-react-native";
import { fonts, gradients, glass, palette } from "./theme";

export function GlassIconButton({
  icon: Icon,
  onPress,
  size = 44,
  iconSize = 20,
  color = palette.text,
  badge,
  style,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  badge?: number | string;
  style?: StyleProp<ViewStyle>;
}) {
  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {glass.useBlur ? (
        <BlurView intensity={glass.blurIntensity} tint={glass.tint} experimentalBlurMethod={glass.androidBlurMethod} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fallbackFill }]} />
      )}
      <LinearGradient colors={gradients.glassElevated} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Icon size={iconSize} color={color} strokeWidth={2} />
    </View>
  );

  const withBadge = (
    <View style={style}>
      {circle}
      {badge != null && (
        <View style={styles.badge}>
          <LinearGradient colors={gradients.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}>
        {withBadge}
      </Pressable>
    );
  }
  return withBadge;
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10, color: "#fff" },
});
