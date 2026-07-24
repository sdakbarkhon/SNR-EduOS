/**
 * BottomSheetFrame — общий каркас нижней шторки (без содержимого).
 * Спека: «SNR EduOS v2 Light.dc.html», шторки строк 2462–2645 + стили
 * aeSheetOv / aeSheetPanel (строки 4227–4228):
 *  оверлей: rgba(23,18,67,.35) + blur(4), opacity .28s;
 *  панель: absolute left/right/bottom 8, r30, градиент 160° W92→W76, blur(26),
 *   border W90, тень 0 -16 50 rgba(64,54,150,.3) + inset-блик W95,
 *   transform translateY(115%) → 0, transition .32s cubic-bezier(.2,.7,.3,1);
 *  полоска-грип: 44×5 r3 rgba(23,18,67,.2) (строка 2464).
 * Тёмные пары — из CSS-оверрайдов макета:
 *  панель: строки 38–42 → 160° rgba(44,36,102,.97)→rgba(23,18,62,.97);
 *  border → rgba(255,255,255,.18) (строка 61);
 *  тень → 0 -18 40 rgba(3,5,18,.5) (строка 74); блик — токен glassInset;
 *  оверлей → rgba(5,3,20,.62) (строки 123–124); грип → W26 (строка 119).
 * Анимация — Animated из RN (без reanimated). Контент шторки — children.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradPoints, shadowStyle, useTheme, type GlassToken, type ShadowToken } from "../theme";
import { GlassBlur, glassConfig, boostAlpha, cssBlurToIntensity, glassSurface } from "./glass";

/** Светлое стекло панели шторки (строка 4228 макета). */
const SHEET_GLASS_LIGHT: GlassToken = {
  angle: 160,
  colors: ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.76)"],
  blur: 26,
};
/** Тёмное стекло панели (CSS-оверрайды, строки 38–42 макета). */
const SHEET_GLASS_DARK: GlassToken = {
  angle: 160,
  colors: ["rgba(44,36,102,0.97)", "rgba(23,18,62,0.97)"],
  blur: 26,
};
const SHEET_BORDER_LIGHT = "rgba(255,255,255,0.9)"; // строка 4228
const SHEET_BORDER_DARK = "rgba(255,255,255,0.18)"; // CSS строка 61
const SHEET_SHADOW_LIGHT: ShadowToken = { x: 0, y: -16, blur: 50, color: "rgba(64,54,150,0.3)" }; // строка 4228
const SHEET_SHADOW_DARK: ShadowToken = { x: 0, y: -18, blur: 40, color: "rgba(3,5,18,0.5)" }; // CSS строка 74
const OVERLAY_LIGHT = "rgba(23,18,67,0.35)"; // строка 4227
const OVERLAY_DARK = "rgba(5,3,20,0.62)"; // CSS строки 123–124
const GRIP_LIGHT = "rgba(23,18,67,0.2)"; // строка 2464
const GRIP_DARK = "rgba(255,255,255,0.26)"; // CSS строка 119

export interface BottomSheetFrameProps {
  visible: boolean;
  /** Тап по оверлею или грипу. */
  onClose?: () => void;
  /** Показывать полоску-грип (по умолчанию true). */
  showGrip?: boolean;
  /** Доп. стиль панели (например maxHeight). */
  panelStyle?: StyleProp<ViewStyle>;
  /** Переопределение светлого оверлея: confirm-модалка использует
   *  rgba(23,18,67,.38) (confOv, строка 4026) против .35 у шторок. */
  overlayColorLight?: string;
  children?: ReactNode;
}

export function BottomSheetFrame({
  visible,
  onClose,
  showGrip = true,
  panelStyle,
  overlayColorLight,
  children,
}: BottomSheetFrameProps) {
  const { tokens, scheme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const dark = scheme === "dark";

  const anim = useRef(new Animated.Value(0)).current; // 0 — скрыто, 1 — показано
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 320, // transition .32s cubic-bezier(.2,.7,.3,1) — строка 4228
        easing: Easing.bezier(0.2, 0.7, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 280, // opacity .28s — строка 4227
        easing: Easing.bezier(0.2, 0.7, 0.3, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);

  if (!mounted) return null;

  const surface = glassSurface(dark ? SHEET_GLASS_DARK : SHEET_GLASS_LIGHT, scheme);
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [windowH, 0], // аналог translateY(115%) высоты панели
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Затемняющий оверлей (blur(4) макета опускаем в пользу нативного
          затемнения: fallback-заливка чуть усилена — единое поведение обеих
          веток через glassConfig). */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: glassConfig.useBlur
                ? (dark ? OVERLAY_DARK : (overlayColorLight ?? OVERLAY_LIGHT))
                : boostAlpha(dark ? OVERLAY_DARK : (overlayColorLight ?? OVERLAY_LIGHT), 0.1),
            },
          ]}
          onPress={onClose}
        >
          {glassConfig.useBlur ? (
            <GlassBlur
              intensity={cssBlurToIntensity(4)}
              tint={scheme}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            borderRadius: 30,
            transform: [{ translateY }],
          },
          shadowStyle(dark ? SHEET_SHADOW_DARK : SHEET_SHADOW_LIGHT),
        ]}
      >
        <View
          style={[
            {
              borderRadius: 30,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: dark ? SHEET_BORDER_DARK : SHEET_BORDER_LIGHT,
              flexDirection: "column",
            },
            panelStyle,
          ]}
        >
          {surface.mode === "blur" ? (
            <>
              <GlassBlur
                intensity={surface.intensity}
                tint={surface.tint}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={surface.colors as [string, string, ...string[]]}
                {...gradPoints(surface.angle)}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]}
            />
          )}
          {/* inset-блик стекла → верхняя hairline (токен glassInset). */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: tokens.glassInset.y,
              backgroundColor: tokens.glassInset.color,
            }}
          />
          {showGrip ? (
            <Pressable
              onPress={onClose}
              style={{
                alignItems: "center",
                paddingTop: 10,
                paddingBottom: 4,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: dark ? GRIP_DARK : GRIP_LIGHT,
                }}
              />
            </Pressable>
          ) : null}
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
