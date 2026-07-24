/**
 * Вход 1 — OnboardingScreen (макет layerA1, строки 1958–1970 «SNR EduOS v2 Light.dc.html»).
 * Логотип + вордмарк + tagline + heroTitle/Sub + иллюстрация onboarding-hero.png
 * + PrimaryButton (start) + 3 ссылки открытия шторок.
 * safe-area верх/низ через useSafeAreaInsets.
 */
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts } from "../../theme";
import { PrimaryButton } from "../../ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { AuthFeaturesSheet } from "./sheets/AuthFeaturesSheet";
import { AuthHelpSheet } from "./sheets/AuthHelpSheet";
import { AuthDemoPickerSheet } from "./sheets/AuthDemoPickerSheet";

type SheetKey = null | "more" | "help" | "demo";

export function OnboardingScreen() {
  const { d } = useAppLocale();
  const { tokens } = useTheme();
  const t = d.parentApp.auth;
  const { setPhase } = useAuthSession();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<SheetKey>(null);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(56, insets.top + 24),
          paddingHorizontal: 22,
          paddingBottom: Math.max(28, insets.bottom + 20),
          gap: 10,
          alignItems: "stretch",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Логотип + вордмарк — макет строка 1961 */}
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center", alignSelf: "center" }}>
          <Image source={require("../../../assets/logo-mark.png")} style={{ width: 38, height: 38 }} resizeMode="contain" />
          <Text style={{ fontFamily: fonts.unbounded700, fontSize: 19, color: tokens.ink1 }}>SNR EduOS</Text>
        </View>

        {/* Tagline — строка 1962 */}
        <Text
          style={{
            fontSize: 9.5,
            letterSpacing: 1.14,
            color: tokens.ink3,
            fontFamily: fonts.manrope700,
            textAlign: "center",
          }}
        >
          {t.tagline}
        </Text>

        {/* Hero title — строка 1964 */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 19,
            lineHeight: 26,
            color: tokens.ink1,
            textAlign: "center",
            paddingHorizontal: 6,
          }}
        >
          {t.heroTitle}
        </Text>

        {/* Hero sub — строка 1965 */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11.5,
            lineHeight: 17,
            color: tokens.ink2,
            textAlign: "center",
            paddingHorizontal: 4,
          }}
        >
          {t.heroSub}
        </Text>

        {/* Иллюстрация — строка 1966 (82%, maxWidth 290) */}
        <Image
          source={require("../../../assets/onboarding-hero.png")}
          style={{ width: "82%", maxWidth: 290, aspectRatio: 1, alignSelf: "center", marginVertical: 2 }}
          resizeMode="contain"
        />

        {/* Primary — «Начать» строка 1967 */}
        <PrimaryButton label={t.start} onPress={() => setPhase("phone")} />

        {/* Три ссылки — «Возможности приложения», «Нужна помощь?», «Демо-режим» */}
        <Pressable onPress={() => setSheet("more")} hitSlop={8} style={{ paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>
            {t.moreTitle}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSheet("help")} hitSlop={8} style={{ paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>
            {t.needHelp}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSheet("demo")} hitSlop={8} style={{ paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>
            {t.demoCtaTitle}
          </Text>
        </Pressable>
      </ScrollView>

      <AuthFeaturesSheet visible={sheet === "more"} onClose={() => setSheet(null)} />
      <AuthHelpSheet visible={sheet === "help"} onClose={() => setSheet(null)} />
      <AuthDemoPickerSheet visible={sheet === "demo"} onClose={() => setSheet(null)} />
    </View>
  );
}

export default OnboardingScreen;
