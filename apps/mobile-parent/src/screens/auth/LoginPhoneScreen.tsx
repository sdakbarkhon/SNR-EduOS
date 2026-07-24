/**
 * Вход 2 — LoginPhoneScreen (макет layerA2, строки 1972–2018 «SNR EduOS v2 Light.dc.html»).
 * Шапка (back + «Нужна помощь?»), заголовок, GlassCard с полем телефона
 * (селектор страны через Popover + input), «или», demo-CTA, Google/Apple
 * строки, legal-текст. Валидация формальная: 9 цифр → активная кнопка.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts, gradPoints, shadowStyle } from "../../theme";
import {
  GlassCard,
  GlassCircleButton,
  PrimaryButton,
  Popover,
} from "../../ui";
import { getAuthFixtures } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import {
  AppleIcon,
  BackArrowIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GoogleIcon,
  SparkleIcon,
  UzFlagIcon,
} from "../../ui/auth/icons";
import { AuthHelpSheet } from "./sheets/AuthHelpSheet";
import { AuthDemoPickerSheet } from "./sheets/AuthDemoPickerSheet";

/** Формат «90 123 45 67» из макета phoneFmt (строка 4248). */
function formatPhone(digits: string): string {
  const m = digits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
  if (!m) return digits;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}

type SheetKey = null | "help" | "demo";

export function LoginPhoneScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { country, phone, setCountry, setPhone, submitPhone, setPhase } = useAuthSession();
  const [countryOpen, setCountryOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKey>(null);

  const { country_codes } = useMemo(() => getAuthFixtures(), []);
  const canSubmit = phone.length === 9;

  const arrowGrad = gradPoints(120);

  return (
    <View style={{ flex: 1 }}>
      {/* Шапка A2 — back + текст-ссылка «Нужна помощь?» */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => setPhase("onboarding")}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setSheet("help")} hitSlop={8}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.accent }}>
            {t.needHelp}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(28, insets.bottom + 20),
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Заголовок — 1979 */}
        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, lineHeight: 27, color: tokens.ink1 }}>
          {t.welcome}
        </Text>
        {/* Sub — 1980 */}
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 12, color: tokens.ink2 }}>
          {t.signInSub}
        </Text>

        {/* GlassCard с полем телефона (макет 1981) */}
        <GlassCard radius={22} contentStyle={{ padding: 14 }}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10,
              letterSpacing: 0.5,
              color: tokens.ink2,
              marginBottom: 8,
            }}
          >
            {t.phoneHint}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Селектор страны */}
            <View>
              <Pressable
                onPress={() => setCountryOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 12,
                  paddingHorizontal: 11,
                  borderRadius: 14,
                  backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
                  borderWidth: 1,
                  borderColor: scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)",
                }}
              >
                <UzFlagIcon size={18} />
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>{country}</Text>
                <ChevronDownIcon size={11} color={tokens.ink3} />
              </Pressable>
              <Popover visible={countryOpen} width={190} align="left">
                {country_codes.map(([name, code]) => (
                  <Pressable
                    key={code}
                    onPress={() => {
                      setCountry(code);
                      setCountryOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 12.5, color: tokens.ink1 }}>{name}</Text>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink2 }}>{code}</Text>
                  </Pressable>
                ))}
              </Popover>
            </View>

            {/* Телефон */}
            <TextInput
              value={formatPhone(phone)}
              onChangeText={setPhone}
              placeholder={t.phonePlaceholder}
              placeholderTextColor={tokens.ink3}
              keyboardType="phone-pad"
              inputMode="numeric"
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 13,
                borderRadius: 14,
                fontFamily: fonts.manrope800,
                fontSize: 14,
                color: tokens.ink1,
                backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
                borderWidth: 1,
                borderColor: scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)",
              }}
              maxLength={12}
            />
          </View>
          {/* Продолжить — активна при 9 цифрах */}
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label={t.continue}
              disabled={!canSubmit}
              onPress={() => {
                if (canSubmit) submitPhone();
              }}
            />
          </View>
        </GlassCard>

        {/* «или» — разделитель (макет 2002) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: tokens.ink3 }} />
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink3 }}>{t.or}</Text>
          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: tokens.ink3 }} />
        </View>

        {/* Демо-CTA — макет 2005 (ВЫШЕ Google/Apple, как в макете) */}
        <GlassCard
          radius={16}
          contentStyle={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }}
          onPress={() => setSheet("demo")}
        >
          <View style={[shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(124,58,237,0.35)" }), { borderRadius: 11 }]}>
            <LinearGradient
              colors={["#7C3AED", "#4F6DF5"]}
              start={arrowGrad.start}
              end={arrowGrad.end}
              style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" }}
            >
              <SparkleIcon size={18} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
              {t.demoCtaTitle}
            </Text>
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>
              {t.demoCtaSub}
            </Text>
          </View>
          <ChevronRightIcon size={16} color={tokens.ink3} />
        </GlassCard>

        {/* Google/Apple — макет 2010, 2014 */}
        <GlassCard radius={16} contentStyle={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoogleIcon size={18} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
            {t.withGoogle}
          </Text>
        </GlassCard>
        <GlassCard radius={16} contentStyle={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppleIcon size={18} color={tokens.ink1} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
            {t.withApple}
          </Text>
        </GlassCard>

        {/* Legal — макет 2016 */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 9.5,
            lineHeight: 15,
            color: tokens.ink3,
            textAlign: "center",
            paddingHorizontal: 10,
            paddingTop: 6,
          }}
        >
          {t.legalPrefix}
          <Text style={{ fontFamily: fonts.manrope800, color: tokens.accent }}>{t.legalTerms}</Text>
          {t.legalAnd}
          <Text style={{ fontFamily: fonts.manrope800, color: tokens.accent }}>{t.legalPrivacy}</Text>
        </Text>
      </ScrollView>

      <AuthHelpSheet visible={sheet === "help"} onClose={() => setSheet(null)} />
      <AuthDemoPickerSheet visible={sheet === "demo"} onClose={() => setSheet(null)} />
    </View>
  );
}

export default LoginPhoneScreen;
