/**
 * Матовое стекло — базовая карточка/поверхность liquid-glass.
 *
 * Слои (снизу вверх): BlurView (или полупрозрачная заливка при glass.useBlur=false)
 * → градиентный overlay (плотность по variant) → hairline-подсветка сверху
 * (замена недоступного в RN `inset 0 1px 0` box-shadow) → контент.
 *
 * ANDROID: сила/наличие блюра управляются ЕДИНЫМ конфигом glass.* в theme.ts
 * (blurIntensity / useBlur) — понизить нагрузку на слабых устройствах можно,
 * не трогая экраны.
 */
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, palette, radii, shadows, glass, type GlassVariant } from "./theme";

const VARIANT_GRADIENT: Record<GlassVariant, readonly [string, string]> = {
  std: gradients.glassStd,
  elevated: gradients.glassElevated,
  bright: gradients.glassBright,
};

export type GlassCardProps = {
  children?: ReactNode;
  variant?: GlassVariant;
  radius?: number;
  borderColor?: string;
  /** мягкая цветная тень-свечение под карточкой */
  glow?: keyof typeof shadows | null;
  /** верхняя hairline-подсветка (inset-замена). По умолчанию у elevated/bright. */
  highlight?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function GlassCard({
  children,
  variant = "std",
  radius = radii.xxl,
  borderColor,
  glow = null,
  highlight,
  style,
  contentStyle,
  onPress,
}: GlassCardProps) {
  const border = borderColor ?? (variant === "std" ? palette.glassBorder : palette.glassBorderSoft);
  const showHighlight = highlight ?? variant !== "std";

  const inner = (
    <View style={[{ borderRadius: radius, borderWidth: 1, borderColor: border, overflow: "hidden" }, style]}>
      {glass.useBlur ? (
        <BlurView
          intensity={glass.blurIntensity}
          tint={glass.tint}
          experimentalBlurMethod={glass.androidBlurMethod}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fallbackFill }]} />
      )}
      <LinearGradient
        colors={VARIANT_GRADIENT[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {showHighlight && <View style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />}
      <View style={contentStyle}>{children}</View>
    </View>
  );

  // Тень-свечение вешаем на внешний контейнер (у него нет overflow:hidden,
  // иначе тень бы обрезалась вместе со стеклом).
  const glowStyle = glow ? shadows[glow] : undefined;

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [glowStyle, pressed && styles.pressed]}>
        {inner}
      </Pressable>
    );
  }
  return glowStyle ? <View style={glowStyle}>{inner}</View> : inner;
}

const styles = StyleSheet.create({
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: palette.highlight,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
