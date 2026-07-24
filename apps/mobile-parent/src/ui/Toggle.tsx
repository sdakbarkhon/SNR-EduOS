/**
 * Toggle — тумблер настройки.
 * Спека: «SNR EduOS v2 Light.dc.html»:
 * — трек tgTrack(): JS строка 3773 — 44×26 r13; on: accent-градиент 135° +
 *   тень 0 4 10 rgba(124,58,237,.35); off: rgba(23,18,67,.14);
 * — кноб tgKnob(): JS строка 3774 — 20px белый, top 3, left 3↔21,
 *   transition .22s (здесь — Animated);
 * — образец: «Библиотека» §s7, строка 2778; автоплатёж П17 — строка 395.
 * Тёмные пары: off-трек rgba(23,18,67,.14) → rgba(255,255,255,.18)
 * (CSS-оверрайд, строка 128); тень on — glow tokens.shColor.
 * Presentational: состояние только через props, тема — useTheme().
 */
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradPoints, shadowStyle, useTheme } from "../theme";

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Тень on-трека (светлая) 0 4 10 rgba(124,58,237,.35) — JS строка 3773. */
const ON_SHADOW_LIGHT = { x: 0, y: 4, blur: 10, color: "rgba(124,58,237,0.35)" };
/** RGB акцента для тёмного glow (tokens.shColor). */
const ACCENT_RGB = "124,58,237";
/** off-трек: светлая rgba(23,18,67,.14) (JS 3773); тёмная — CSS строка 128. */
const OFF_TRACK = {
  light: "rgba(23,18,67,0.14)",
  dark: "rgba(255,255,255,0.18)",
};

const TRACK_W = 44;
const TRACK_H = 26;
const KNOB = 20;
const KNOB_PAD = 3;
/** Ход кноба: left 3 → 21 (JS строка 3774). */
const KNOB_TRAVEL = TRACK_W - KNOB - KNOB_PAD * 2;

export function Toggle({ value, onValueChange, disabled = false, style }: ToggleProps) {
  const { tokens, scheme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    // transition .22s из макета (JS строка 3774).
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, KNOB_TRAVEL],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onPress={disabled ? undefined : () => onValueChange(!value)}
      disabled={disabled}
      style={[
        styles.track,
        { backgroundColor: OFF_TRACK[scheme] },
        value
          ? shadowStyle(scheme === "dark" ? tokens.shColor(ACCENT_RGB) : ON_SHADOW_LIGHT)
          : null,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {/* on-состояние: accent-градиент, плавное появление (background .25s в макете). */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim, borderRadius: TRACK_H / 2, overflow: "hidden" }]}>
        <LinearGradient
          colors={tokens.accentGrad.colors as [string, string]}
          {...gradPoints(tokens.accentGrad.angle)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    flexShrink: 0,
  },
  knob: {
    position: "absolute",
    top: KNOB_PAD,
    left: KNOB_PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "#FFFFFF",
  },
});
