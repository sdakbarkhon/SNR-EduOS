/**
 * DemoBannerGlass — жёлтое стекло демо-баннера с крестиком.
 * Спека: «SNR EduOS v2 Light.dc.html»:
 *  стиль demoBannerSt (строка 4273): row, gap 7, паддинг 7×10, r12,
 *   фон rgba(254,240,138,.75) + blur(14), border rgba(202,138,4,.4),
 *   тень 0 8 20 rgba(202,138,4,.2) (позиционирование absolute top 40
 *   left/right 12 — задаёт вызывающий через style);
 *  разметка строк 2064–2067: значок-треугольник 14 #a16207/2, текст 9.5/800
 *   #854d0e, крестик — круг 20 rgba(133,77,14,.12) + X 10 #854d0e/2.6.
 * Тёмная пара — CSS-оверрайды [data-snr-dark] макета:
 *  фон/бордер → rgba(202,138,4,.24) / rgba(251,191,36,.5) (строка 159);
 *  круг крестика → rgba(251,191,36,.22) (строка 160);
 *  #a16207 → #eab308 (строка 99); #854d0e → #fcd34d (строки 106, 189);
 *  тёмной пары для тени в CSS нет — оставлены светлые значения.
 * ПРЕЗЕНТАЦИОННАЯ замена вёрстки старого src/components/DemoBanner.tsx
 * (сам старый файл не трогаем — подключение на этапе auth); текст — через prop.
 */
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, shadowStyle, useTheme, type ShadowToken } from "../theme";
import { GlassBlur, glassConfig, boostAlpha, cssBlurToIntensity } from "./glass";

const BANNER_BG_LIGHT = "rgba(254,240,138,0.75)"; // строка 4273
const BANNER_BG_DARK = "rgba(202,138,4,0.24)"; // CSS строка 159
const BANNER_BORDER_LIGHT = "rgba(202,138,4,0.4)"; // строка 4273
const BANNER_BORDER_DARK = "rgba(251,191,36,0.5)"; // CSS строка 159
/** 0 8 20 rgba(202,138,4,.2) — строка 4273; тёмной пары в CSS нет. */
const BANNER_SHADOW: ShadowToken = { x: 0, y: 8, blur: 20, color: "rgba(202,138,4,0.2)" };
const ICON_LIGHT = "#a16207"; // строка 2065
const ICON_DARK = "#eab308"; // CSS строка 99
const TEXT_LIGHT = "#854d0e"; // строки 2066–2067
const TEXT_DARK = "#fcd34d"; // CSS строки 106, 189
const CLOSE_BG_LIGHT = "rgba(133,77,14,0.12)"; // строка 2067
const CLOSE_BG_DARK = "rgba(251,191,36,0.22)"; // CSS строка 160

export interface DemoBannerGlassProps {
  /** Текст баннера, напр. «Демо-режим. Все действия влияют на реальные данные». */
  message: string;
  onClose?: () => void;
  /** Позиционирование (в макете absolute top 40, left/right 12, zIndex 31). */
  style?: StyleProp<ViewStyle>;
}

export function DemoBannerGlass({ message, onClose, style }: DemoBannerGlassProps) {
  const { scheme } = useTheme();
  const dark = scheme === "dark";
  const bg = dark ? BANNER_BG_DARK : BANNER_BG_LIGHT;

  return (
    <View style={[shadowStyle(BANNER_SHADOW), { borderRadius: 12 }, style]}>
      <View
        style={{
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: dark ? BANNER_BORDER_DARK : BANNER_BORDER_LIGHT,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingVertical: 7,
          paddingHorizontal: 10,
        }}
      >
        {glassConfig.useBlur ? (
          <>
            <GlassBlur
              intensity={cssBlurToIntensity(14)}
              tint={scheme}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
          </>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: boostAlpha(bg, 0.2) },
            ]}
          />
        )}
        {/* Треугольник-предупреждение (строка 2065). */}
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke={dark ? ICON_DARK : ICON_LIGHT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M12 9v4" />
          <Path d="M12 17h.01" />
          <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </Svg>
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.manrope800,
            fontSize: 9.5,
            color: dark ? TEXT_DARK : TEXT_LIGHT,
          }}
        >
          {message}
        </Text>
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: dark ? CLOSE_BG_DARK : CLOSE_BG_LIGHT,
            }}
          >
            <Svg
              width={10}
              height={10}
              viewBox="0 0 24 24"
              fill="none"
              stroke={dark ? TEXT_DARK : TEXT_LIGHT}
              strokeWidth={2.6}
              strokeLinecap="round"
            >
              <Path d="M18 6 6 18" />
              <Path d="m6 6 12 12" />
            </Svg>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
