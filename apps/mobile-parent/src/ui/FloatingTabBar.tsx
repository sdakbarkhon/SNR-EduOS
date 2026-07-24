/**
 * FloatingTabBar — фирменный плавающий стеклянный таб-бар.
 * Спека: «SNR EduOS v2 Light.dc.html»:
 *  контейнер tabBarStyle (строка 4231): absolute left 16 / right 16 / bottom 14,
 *   padding 7, r28, градиент 160° W78→W55 + blur(26), border 1px W85,
 *   тень 0 20 48 rgba(78,66,190,.3) (= токен shFloat light) + inset-блик W95
 *   (→ hairline, токен glassInset);
 *  пункт tb() (строки 3506–3510): flex 1, колонка, gap 3, padding 8 0;
 *   активный — r21, accent-градиент 135°, тень 0 8 20 rgba(124,58,237,.4),
 *   цвет #fff; неактивный — rgba(26,19,74,.55);
 *  разметка пунктов (строки 2648–2652): иконка 20 stroke 1.9, подпись 9.5/800;
 *   бейдж «Сообщений» absolute top 2 right 14, 15px r8 (строка 2651) —
 *   компонент CountBadge (preset alert).
 * Тёмные пары: фон/бордер — glass1/glassBorder тёмных токенов (CSS строки 28, 60);
 *  неактивный rgba(26,19,74,.55) → rgba(255,255,255,.58) (CSS строка 86);
 *  тень — токен shFloat (dark); тень активной пилюли — glow tokens.shColor.
 * Home-indicator макета (строка 2654) НЕ рисуем — реальный телефон даёт свой.
 * Presentational: пункты/лейблы/бейджи — только через props; тема — useTheme().
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, gradPoints, shadowStyle, useTheme } from "../theme";
import { CountBadge } from "./CountBadge";
import { GlassBlur, glassSurface } from "./glass";

/** Стекло таб-бара (светлая — строка 4231; тёмная — CSS строка 28 = glass1 dark). */
const BAR_GLASS_LIGHT = {
  angle: 160,
  colors: ["rgba(255,255,255,0.78)", "rgba(255,255,255,0.55)"],
  blur: 26,
};
/** Бордер W85 (строка 4231); тёмная пара — CSS строка 60 (W85 → W18). */
const BAR_BORDER = { light: "rgba(255,255,255,0.85)", dark: "rgba(255,255,255,0.18)" };
/** Неактивный пункт rgba(26,19,74,.55) (строка 3509); тёмная пара — CSS строка 86. */
const ITEM_INACTIVE = { light: "rgba(26,19,74,0.55)", dark: "rgba(255,255,255,0.58)" };
/** Тень активной пилюли 0 8 20 rgba(124,58,237,.4) (строка 3509); тёмная — glow shColor. */
const PILL_SHADOW_LIGHT = { x: 0, y: 8, blur: 20, color: "rgba(124,58,237,0.4)" };
const ACCENT_RGB = "124,58,237";

export interface FloatingTabItem {
  /** Ключ маршрута (p5/p10/p17/d24/dhub). */
  key: string;
  /** Подпись 9.5/800. */
  label: string;
  /** Иконка 20px stroke 1.9 — рендер-функция от текущего цвета пункта. */
  icon: (color: string) => ReactNode;
  /** Значение бейджа (строка 2651 — «Сообщения»); нет/0 — не рендерится. */
  badge?: number;
}

export interface FloatingTabBarProps {
  items: FloatingTabItem[];
  activeKey: string;
  onPress: (key: string) => void;
}

export function FloatingTabBar({ items, activeKey, onPress }: FloatingTabBarProps) {
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = scheme === "dark";

  const surface = glassSurface(dark ? { ...tokens.glass1, blur: 26 } : BAR_GLASS_LIGHT, scheme);
  const accent = gradPoints(tokens.accentGrad.angle);

  return (
    <View
      style={[
        {
          position: "absolute",
          left: 16,
          right: 16,
          // В макете bottom 14 (кадр без реального home-indicator);
          // на устройстве поднимаем бар над индикатором через safe-area.
          bottom: Math.max(insets.bottom, 14),
          borderRadius: 28,
        },
        shadowStyle(tokens.shFloat),
      ]}
    >
      <View
        style={{
          borderRadius: 28,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: dark ? BAR_BORDER.dark : BAR_BORDER.light,
        }}
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
          <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
        )}
        {/* inset-блик стекла → верхняя hairline-полоска (токен glassInset). */}
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
        <View style={{ flexDirection: "row", alignItems: "center", padding: 7 }}>
          {items.map((item) => {
            const active = item.key === activeKey;
            const color = active
              ? "#FFFFFF"
              : dark
                ? ITEM_INACTIVE.dark
                : ITEM_INACTIVE.light;

            const inner = (
              <>
                {item.icon(color)}
                <Text
                  style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color }}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  // Бейдж «Сообщений»: 15px r8, top 2 right 14 (строка 2651).
                  <CountBadge
                    value={item.badge}
                    preset="alert"
                    size={15}
                    style={{ position: "absolute", top: 2, right: 14 }}
                  />
                ) : null}
              </>
            );

            return (
              <Pressable
                key={item.key}
                onPress={() => onPress(item.key)}
                style={{ flex: 1 }}
              >
                {active ? (
                  <LinearGradient
                    colors={tokens.accentGrad.colors as [string, string]}
                    start={accent.start}
                    end={accent.end}
                    style={[
                      styles.item,
                      { borderRadius: 21 },
                      shadowStyle(
                        dark ? tokens.shColor(ACCENT_RGB) : PILL_SHADOW_LIGHT,
                      ),
                    ]}
                  >
                    {inner}
                  </LinearGradient>
                ) : (
                  <View style={styles.item}>{inner}</View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: "relative",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingVertical: 8,
  },
});
