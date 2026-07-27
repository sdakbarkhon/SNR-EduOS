/**
 * AuthFeaturesSheet — «Возможности приложения» (макет authSheet='more',
 * строки 2070–2092 «SNR EduOS v2 Light.dc.html»).
 *
 * Порядок блоков (строго по block-list Заходa 4a):
 *   1. Overlay (закрытие по клику) — в BottomSheetFrame;
 *   2. Sheet handle (44×5 pill, клик закрывает) — в BottomSheetFrame (showGrip);
 *   3. Заголовок «Возможности приложения» (14/800/#171243);
 *   4. Подзаголовок «Всё о школьной жизни ребёнка в одном месте.»
 *      (10/600, line-height 1.5, rgba(26,19,74,.6));
 *   5. 4 фича-строки (icon 36 + title 12/800/#171243 + sub 9.5/600/rgba(26,19,74,.6),
 *      разделители сверху со 2-й);
 *   6. CTA «Закрыть» — фиолетово-синий градиент, padding 13, radius 15,
 *      shadow 0 12 28 rgba(124,58,237,.4) + inset-hairline W35, текст 13/800/#fff.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import {
  ChatIcon,
  CheckSquareIcon,
  ClipboardIcon,
  CreditCardIcon,
} from "../../../ui/auth/icons";

export interface AuthFeaturesSheetProps {
  visible: boolean;
  onClose(): void;
}

interface FeatureRow {
  title: string;
  sub: string;
  grad: [string, string];
  icon: ReactNode;
}

/** CTA-градиент: 135° #7C3AED → #4F6DF5 (строка 2088 макета). */
const CTA_COLORS: [string, string] = ["#7C3AED", "#4F6DF5"];
/** CTA-тень: 0 12 28 rgba(124,58,237,.4) (строка 2088). */
const CTA_SHADOW = { x: 0, y: 12, blur: 28, color: "rgba(124,58,237,0.4)" };
/** inset-hairline W35 «inset 0 1.5 0 rgba(255,255,255,.35)» (строка 2088). */
const CTA_HAIRLINE = { height: 1.5, color: "rgba(255,255,255,0.35)" };
/** Разделитель между строками (rowSt.borderTop, строка 4282). */
const ROW_DIVIDER_LIGHT = "rgba(23,18,67,0.06)";
const ROW_DIVIDER_DARK = "rgba(255,255,255,0.08)";

export function AuthFeaturesSheet({ visible, onClose }: AuthFeaturesSheetProps) {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const gr = gradPoints(135);
  const dividerColor = scheme === "dark" ? ROW_DIVIDER_DARK : ROW_DIVIDER_LIGHT;

  // Данные 4 фич (строка 4280 макета, ветка authInfoRows для 'more').
  const rows: FeatureRow[] = [
    {
      title: t.featEduTitle,
      sub: t.featEduSub,
      grad: ["#34D399", "#059669"],
      icon: <CheckSquareIcon size={18} />,
    },
    {
      title: t.featHwTitle,
      sub: t.featHwSub,
      grad: ["#60A5FA", "#2563EB"],
      icon: <ClipboardIcon size={18} />,
    },
    {
      title: t.featPayTitle,
      sub: t.featPaySub,
      grad: ["#FB923C", "#EF4444"],
      icon: <CreditCardIcon size={18} />,
    },
    {
      title: t.featChatTitle,
      sub: t.featChatSub,
      grad: ["#A78BFA", "#7C3AED"],
      icon: <ChatIcon size={18} />,
    },
  ];

  return (
    <BottomSheetFrame visible={visible} onClose={onClose}>
      {/* 3. Заголовок шторки. */}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: tokens.ink1,
          paddingHorizontal: 20,
          paddingTop: 2,
        }}
      >
        {t.moreTitle}
      </Text>
      {/* 4. Подзаголовок шторки. */}
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 10,
          lineHeight: 15, // line-height 1.5 при size 10
          color: tokens.ink2,
          paddingHorizontal: 20,
          paddingTop: 3,
          paddingBottom: 8,
        }}
      >
        {t.moreIntro}
      </Text>

      {/* 5. Список 4 фич. */}
      <View style={{ paddingHorizontal: 20 }}>
        {rows.map((r, i) => (
          <View
            key={r.title}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: dividerColor,
            }}
          >
            {/* Круглая градиентная иконка 36×36, r13, glow-тень от нижнего цвета. */}
            <View
              style={[
                shadowStyle({ x: 0, y: 6, blur: 14, color: `${r.grad[1]}66` }),
                { borderRadius: 13 },
              ]}
            >
              <LinearGradient
                colors={r.grad}
                start={gr.start}
                end={gr.end}
                style={styles.iconTile}
              >
                {r.icon}
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12,
                  color: tokens.ink1,
                }}
              >
                {r.title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: tokens.ink2,
                  marginTop: 2,
                }}
              >
                {r.sub}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 6. CTA «Закрыть» — inline по метрикам макета (padding 13, r15, size 13). */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 }}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            shadowStyle(CTA_SHADOW),
            { borderRadius: 15 },
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          <LinearGradient
            colors={CTA_COLORS}
            start={gr.start}
            end={gr.end}
            style={styles.cta}
          >
            <Text style={styles.ctaLabel}>{t.close}</Text>
            <View
              pointerEvents="none"
              style={[
                styles.ctaHairline,
                {
                  height: CTA_HAIRLINE.height,
                  backgroundColor: CTA_HAIRLINE.color,
                },
              ]}
            />
          </LinearGradient>
        </Pressable>
      </View>
    </BottomSheetFrame>
  );
}

const styles = StyleSheet.create({
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 13,
    borderRadius: 15,
    overflow: "hidden",
  },
  ctaLabel: {
    fontFamily: fonts.manrope800,
    fontSize: 13,
    color: "#FFFFFF",
  },
  ctaHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});

export default AuthFeaturesSheet;
