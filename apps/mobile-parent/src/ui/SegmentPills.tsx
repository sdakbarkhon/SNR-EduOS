/**
 * SegmentPills — ряд пилюль-фильтров/табов.
 * Спека: «SNR EduOS v2 Light.dc.html»:
 * — сегментные табы gt(): JS строка 3835, использование строка 290 (табы Успехов):
 *   flex:1, паддинг 9×0, r999, 11.5; активная — accent-градиент 135°, белый 800,
 *   тень 0 8 18 rgba(124,58,237,.35); неактивная — стекло 160° W60→W40,
 *   бордер W75, текст rgba(26,19,74,.66)/700; контейнер gap 7;
 * — скролл-фильтры hwChip(): JS строки 3511–3515, использование строки 504–507
 *   (фильтры ДЗ): паддинг 7×11, 11/800; активная — accent-градиент,
 *   тень 0 7 16 rgba(124,58,237,.35); неактивная — rgba(255,255,255,.6) +
 *   бордер W80 + backdrop-blur(14); горизонтальный скролл, gap 7.
 * Тёмные пары: CSS-оверрайды строк 37 (W60→W40 → glass-2 135° .11/.04),
 * 57 (border W75 → .14), 44 (bg W60 → .09), 56 (border W80 → .16),
 * 85 (текст .66 → rgba(255,255,255,.68)).
 * Presentational: items только через props, тема — useTheme().
 */
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, radius, shadowStyle, useTheme } from "../theme";
import { GlassBlur, glassConfig, boostAlpha } from "./glass";

export interface SegmentPillsProps {
  items: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** true — скролл-фильтры (hwChip), false — равноширинные табы (gt). */
  scrollable?: boolean;
  /** Заход 4 (d24 «Сообщения»): индексы пилюль с красной точкой-бейджем 6×6
   *  в правом верхнем углу лейбла (только у «Сервисы» на макете). */
  dotIndexes?: number[];
  style?: StyleProp<ViewStyle>;
}

/** RGB акцента для тёмного glow активной пилюли (tokens.shColor). */
const ACCENT_RGB = "124,58,237";
/** Тени активной пилюли (светлая): gt 0 8 18 .35 (строка 3835), hwChip 0 7 16 .35 (строка 3512). */
const ACTIVE_SHADOW_GT = { x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" };
const ACTIVE_SHADOW_HW = { x: 0, y: 7, blur: 16, color: "rgba(124,58,237,0.35)" };

/** Неактивная gt-пилюля: светлая 160° W60→W40 + бордер W75 (строка 3835); тёмная — CSS строки 37, 57. */
const GT_INACTIVE = {
  light: {
    colors: ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.4)"] as [string, string],
    angle: 160,
    border: "rgba(255,255,255,0.75)",
    text: "rgba(26,19,74,0.66)",
  },
  dark: {
    colors: ["rgba(255,255,255,0.11)", "rgba(255,255,255,0.04)"] as [string, string],
    angle: 135,
    border: "rgba(255,255,255,0.14)",
    text: "rgba(255,255,255,0.68)",
  },
};

/** Неактивная hwChip-пилюля: светлая bg W60 + бордер W80 + blur(14) (строки 3513, 3857); тёмная — CSS строки 44, 56. */
const HW_INACTIVE = {
  light: { bg: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.8)" },
  dark: { bg: "rgba(255,255,255,0.09)", border: "rgba(255,255,255,0.16)" },
};
/** blur(14) hwChip → intensity по общему коэффициенту glass-конфига (14 × 2.5). */
const HW_BLUR_INTENSITY = 35;

export function SegmentPills({
  items,
  activeIndex,
  onChange,
  scrollable = false,
  dotIndexes,
  style,
}: SegmentPillsProps) {
  const { tokens, scheme } = useTheme();
  const dotSet = new Set(dotIndexes ?? []);

  const renderDot = () => (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 4,
        right: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#ef4444",
      }}
    />
  );

  const renderPill = (label: string, index: number) => {
    const active = index === activeIndex;
    const key = `${index}-${label}`;
    const dot = dotSet.has(index) ? renderDot() : null;

    if (active) {
      const shadow =
        scheme === "dark"
          ? tokens.shColor(ACCENT_RGB)
          : scrollable
            ? ACTIVE_SHADOW_HW
            : ACTIVE_SHADOW_GT;
      return (
        <Pressable
          key={key}
          onPress={() => onChange(index)}
          style={[shadowStyle(shadow), { borderRadius: radius.chip }, !scrollable && styles.flexPill]}
        >
          <LinearGradient
            colors={tokens.accentGrad.colors as [string, string]}
            {...gradPoints(tokens.accentGrad.angle)}
            style={[styles.pill, scrollable ? styles.pillHw : styles.pillGt]}
          >
            <Text
              style={[
                scrollable ? styles.labelHw : styles.labelGtActive,
                { color: "#FFFFFF" },
              ]}
            >
              {label}
            </Text>
            {dot}
          </LinearGradient>
        </Pressable>
      );
    }

    if (scrollable) {
      const c = HW_INACTIVE[scheme];
      return (
        <Pressable
          key={key}
          onPress={() => onChange(index)}
          style={[
            styles.pill,
            styles.pillHw,
            { borderWidth: 1, borderColor: c.border, overflow: "hidden" },
            // Fallback без блюра: усиленная альфа заливки (единый конфиг glass.ts).
            !glassConfig.useBlur && { backgroundColor: boostAlpha(c.bg, 0.2) },
          ]}
        >
          {glassConfig.useBlur ? (
            <>
              <GlassBlur
                intensity={HW_BLUR_INTENSITY}
                tint={scheme}
                style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />
            </>
          ) : null}
          <Text style={[styles.labelHw, { color: tokens.ink1 }]}>{label}</Text>
          {dot}
        </Pressable>
      );
    }

    const g = GT_INACTIVE[scheme];
    return (
      <Pressable key={key} onPress={() => onChange(index)} style={styles.flexPill}>
        <LinearGradient
          colors={g.colors}
          {...gradPoints(g.angle)}
          style={[styles.pill, styles.pillGt, { borderWidth: 1, borderColor: g.border }]}
        >
          <Text style={[styles.labelGtInactive, { color: g.text }]}>{label}</Text>
          {dot}
        </LinearGradient>
      </Pressable>
    );
  };

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={style}
        contentContainerStyle={styles.rowScroll}
      >
        {items.map(renderPill)}
      </ScrollView>
    );
  }
  return <View style={[styles.row, style]}>{items.map(renderPill)}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 7,
  },
  rowScroll: {
    flexDirection: "row",
    gap: 7,
    paddingBottom: 2,
  },
  flexPill: {
    flex: 1,
  },
  pill: {
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  pillGt: {
    paddingVertical: 9,
    paddingHorizontal: 0,
  },
  pillHw: {
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  labelGtActive: {
    fontFamily: fonts.manrope800,
    fontSize: 11.5,
  },
  labelGtInactive: {
    fontFamily: fonts.manrope700,
    fontSize: 11.5,
  },
  labelHw: {
    fontFamily: fonts.manrope800,
    fontSize: 11,
  },
});
