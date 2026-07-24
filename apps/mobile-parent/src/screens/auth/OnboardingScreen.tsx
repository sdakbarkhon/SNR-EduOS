/**
 * Заход 4a — Онбординг (Вход 1) по макету «SNR EduOS v2 Light.dc.html» строки 1958–1970.
 * Строгий block-list из ТЗ Захода 4:
 *   1. Логотип-хедер (SNR-марк + wordmark «SNR EduOS»)
 *   2. Тэглайн-капс «SCHOOL OS OF THE FUTURE»
 *   3. Hero-заголовок (t.heroTitle)
 *   4. Hero-subtitle (t.heroSub)
 *   5. Hero-иллюстрация onboarding-hero.png
 *   6. CTA-кнопка «Начать» — оранжево-розовый градиент 120deg #f97316→#ec4899,
 *      radius 18, shadow 0 14 34 rgba(236,72,153,.4), inset hairline W35 (goA2 → phase="phone")
 *   7. Ссылка «Узнать больше» — фиолетовый #6d28d9, 12/800 (openMore → AuthFeaturesSheet)
 * Обе темы (tokens.ink1/ink2/ink3), safe-area верх/низ через useSafeAreaInsets.
 */
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { useAuthSession } from "../../context/AuthSessionContext";
import { AuthFeaturesSheet } from "./sheets/AuthFeaturesSheet";

export function OnboardingScreen() {
  const { d } = useAppLocale();
  const { tokens } = useTheme();
  const t = d.parentApp.auth;
  const { setPhase } = useAuthSession();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(56, insets.top + 24),
          paddingHorizontal: 22,
          paddingBottom: Math.max(28, insets.bottom + 20),
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1 + 2 — логотип-хедер и тэглайн-капс (макет строки 1960–1962) */}
        <View style={{ alignItems: "center", gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Image
              source={require("../../../assets/logo-mark.png")}
              style={{ width: 38, height: 38 }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontFamily: fonts.unbounded700,
                fontSize: 19,
                color: tokens.ink1,
              }}
            >
              SNR EduOS
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 9.5,
              letterSpacing: 1.14,
              color: tokens.ink3,
              opacity: 0.9,
            }}
          >
            {t.tagline}
          </Text>
        </View>

        {/* 3 — Hero-заголовок (макет строка 1964) */}
        <Text
          style={{
            textAlign: "center",
            fontFamily: fonts.unbounded600,
            fontSize: 19,
            lineHeight: 26,
            color: tokens.ink1,
            paddingHorizontal: 6,
          }}
        >
          {t.heroTitle}
        </Text>

        {/* 4 — Hero-subtitle (макет строка 1965) */}
        <Text
          style={{
            textAlign: "center",
            fontFamily: fonts.manrope600,
            fontSize: 11.5,
            lineHeight: 17,
            color: tokens.ink2,
          }}
        >
          {t.heroSub}
        </Text>

        {/* 5 — Hero-иллюстрация (макет строка 1966) */}
        <Image
          source={require("../../../assets/onboarding-hero.png")}
          style={{
            width: "82%",
            maxWidth: 290,
            aspectRatio: 1,
            alignSelf: "center",
            marginVertical: 2,
          }}
          resizeMode="contain"
        />

        {/* 6 — CTA «Начать»: оранж-розовый 120° градиент (макет строка 1967) */}
        <Pressable
          onPress={() => setPhase("phone")}
          style={({ pressed }) => [
            shadowStyle({ x: 0, y: 14, blur: 34, color: "rgba(236,72,153,0.4)" }),
            { borderRadius: 18 },
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <LinearGradient
            colors={["#f97316", "#ec4899"]}
            {...gradPoints(120)}
            style={styles.ctaInner}
          >
            <Text style={styles.ctaLabel}>{t.start}</Text>
            {/* inset-hairline W35 — верхний блик по стеклу (макет строка 1967) */}
            <View pointerEvents="none" style={styles.ctaHairline} />
          </LinearGradient>
        </Pressable>

        {/* 7 — Ссылка «Узнать больше» → шторка Возможности (макет строка 1968) */}
        <Pressable
          onPress={() => setMoreOpen(true)}
          hitSlop={8}
          style={{ paddingTop: 2, paddingBottom: 6, alignItems: "center" }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 12,
              color: "#6d28d9",
              textAlign: "center",
            }}
          >
            {t.learnMore}
          </Text>
        </Pressable>
      </ScrollView>

      <AuthFeaturesSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  ctaLabel: {
    fontFamily: fonts.manrope800,
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  ctaHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});

export default OnboardingScreen;
