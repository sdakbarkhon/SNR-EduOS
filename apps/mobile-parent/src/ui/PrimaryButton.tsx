/**
 * PrimaryButton — главная accent-кнопка («Оплатить всё» / checkout).
 * Спека: «SNR EduOS v2 Light.dc.html», строка 397 (кнопка «Оплатить всё» П17):
 * accent-градиент 135° (tokens.accentGrad), r16, padding 15, текст 14/800 #fff,
 * тень 0 14 32 rgba(124,58,237,.4) (тёмная пара — glow tokens.shColor),
 * inset-блик «inset 0 1.5 0 W35» → верхняя hairline-полоска.
 * Presentational: тексты/иконка только через props, тема — useTheme().
 */
import { useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, shadowStyle, useTheme } from "../theme";

export interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Иконка слева от текста (белый SVG-глиф 16px, gap 8 — макет строка 397). */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Запрос в полёте: вместо надписи — кружок ожидания, нажатия не проходят. */
  loading?: boolean;
  /** Подпись под кружком, если ожидание затянулось (см. hintAfterMs). */
  loadingHint?: string | null;
}

/** Тень кнопки (светлая) 0 14 32 rgba(124,58,237,.4) — макет строка 397. */
const SHADOW_LIGHT = { x: 0, y: 14, blur: 32, color: "rgba(124,58,237,0.4)" };
/** RGB акцента для тёмного glow (tokens.shColor — тёмная пара цветной тени). */
const ACCENT_RGB = "124,58,237";
/** Hairline-блик W35 «inset 0 1.5 0 rgba(255,255,255,.35)» — макет строка 397. */
const INSET_HAIRLINE = { height: 1.5, color: "rgba(255,255,255,0.35)" };

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
  style,
  loading = false,
  loadingHint = null,
}: PrimaryButtonProps) {
  const { tokens, scheme } = useTheme();
  const shadow = scheme === "dark" ? tokens.shColor(ACCENT_RGB) : SHADOW_LIGHT;
  const blocked = disabled || loading;

  // Лёгкое сжатие под пальцем: одной прозрачности мало — на градиенте её
  // почти не видно, и человеку кажется, что нажатие не прошло.
  const press = useRef(new Animated.Value(0)).current;
  const springTo = (v: number) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      onPressIn={() => { if (!blocked) springTo(1); }}
      onPressOut={() => springTo(0)}
      style={[
        shadowStyle(shadow),
        { borderRadius: 16 },
        // Disabled-состояние прозрачностью (в макете отдельного стиля нет).
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      <Animated.View
        style={{
          borderRadius: 16,
          transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }],
        }}
      >
      <LinearGradient
        colors={tokens.accentGrad.colors as [string, string]}
        {...gradPoints(tokens.accentGrad.angle)}
        style={styles.inner}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#FFFFFF" size="small" />
            {loadingHint ? <Text style={styles.label}>{loadingHint}</Text> : null}
          </>
        ) : (
          <>
            {icon ? <View>{icon}</View> : null}
            <Text style={styles.label}>{label}</Text>
          </>
        )}
        {/* inset-блик стекла → верхняя hairline-полоска (W35). */}
        <View
          pointerEvents="none"
          style={[styles.hairline, { height: INSET_HAIRLINE.height, backgroundColor: INSET_HAIRLINE.color }]}
        />
      </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 15,
    borderRadius: 16,
    overflow: "hidden",
  },
  label: {
    fontFamily: fonts.manrope800,
    fontSize: 14,
    color: "#FFFFFF",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
