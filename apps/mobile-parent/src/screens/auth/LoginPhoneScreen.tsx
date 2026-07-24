/**
 * Вход 2 — LoginPhoneScreen (макет layerA2, «SNR EduOS v2 Light.dc.html» 1972–2018).
 *
 * Block-list Захода 4a (строго по порядку сверху вниз):
 *   1. Шапка: back (GlassCircleButton) + text-link «Нужна помощь?».
 *   2. Заголовок Unbounded 20/600 «Добро пожаловать\nв SNR EduOS!».
 *   3. Subtitle 12/600 «Войдите в аккаунт, чтобы продолжить».
 *   4. GlassCard с caps-label «НОМЕР ТЕЛЕФОНА», country-picker + phone input,
 *      кнопка «Продолжить» (PrimaryButton, disabled пока цифр < 9).
 *   5. Разделитель «или» — две hairline-линии.
 *   6. Демо-CTA («Демо-вход для родителя») — фиолетовая рамка rgba(124,58,237,.5).
 *   7. CTA «Войти через Google».
 *   8. CTA «Войти через Apple».
 *   9. Legal-disclaimer со ссылками goTerms / goPrivacy.
 */
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  GlassCard,
  GlassCircleButton,
  Popover,
  PrimaryButton,
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

/** Формат «90 123 45 67» — соответствует phoneFmt макета. */
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
  const { country, phone, setCountry, setPhone, submitPhone, setPhase } =
    useAuthSession();
  const [countryOpen, setCountryOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKey>(null);

  const { country_codes } = useMemo(() => getAuthFixtures(), []);
  const canSubmit = phone.length === 9;

  // Цвета «стеклянного» инпута (страна + телефон) — светлая/тёмная пара.
  const inputBg =
    scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const inputBorder =
    scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)";
  // Hairline «или»: макет rgba(23,18,67,.12) — берём ink3 (в токенах ≈ та же плотность).
  const hairline = tokens.ink3;

  return (
    <View style={{ flex: 1 }}>
      {/* 1. Шапка — back слева, «Нужна помощь?» справа (макет 1973–1977). */}
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
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: tokens.accent,
            }}
          >
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
        {/* 2. Заголовок (макет 1979) — welcome в словаре без \n, но макет двухстрочный. */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 20,
            lineHeight: 27,
            color: tokens.ink1,
          }}
        >
          {t.welcome}
        </Text>
        {/* 3. Subtitle (макет 1980). */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 12,
            color: tokens.ink2,
          }}
        >
          {t.signInSub}
        </Text>

        {/* 4. GlassCard с полем телефона (макет 1981–2000). */}
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
            {/* Country picker + Popover */}
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
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                }}
              >
                <UzFlagIcon size={18} />
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 13,
                    color: tokens.ink1,
                  }}
                >
                  {country}
                </Text>
                <ChevronDownIcon size={11} color={tokens.ink3} />
              </Pressable>
              <Popover visible={countryOpen} width={190} align="left">
                {country_codes.map(([n, code], i) => (
                  <Pressable
                    key={`${n}-${i}`}
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
                    <Text
                      style={{
                        fontFamily: fonts.manrope700,
                        fontSize: 12.5,
                        color: tokens.ink1,
                      }}
                    >
                      {n}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 12.5,
                        color: tokens.ink2,
                      }}
                    >
                      {code}
                    </Text>
                  </Pressable>
                ))}
              </Popover>
            </View>

            {/* Phone input */}
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
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
              }}
              maxLength={12}
            />
          </View>
          {/* CTA «Продолжить» (phoneBtnStyle: disabled → opacity 0.5) */}
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

        {/* 5. Разделитель «или» (макет 2002). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 4,
          }}
        >
          <View
            style={{
              flex: 1,
              height: StyleSheet.hairlineWidth,
              backgroundColor: hairline,
            }}
          />
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 10.5,
              color: tokens.ink3,
            }}
          >
            {t.or}
          </Text>
          <View
            style={{
              flex: 1,
              height: StyleSheet.hairlineWidth,
              backgroundColor: hairline,
            }}
          />
        </View>

        {/* 6. Демо-CTA — фиолетовая рамка rgba(124,58,237,.5) (макет 2003–2007). */}
        <GlassCard
          radius={16}
          contentStyle={{
            padding: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            borderWidth: 1.5,
            borderColor: "rgba(124,58,237,0.5)",
          }}
          onPress={() => setSheet("demo")}
        >
          <View
            style={[
              shadowStyle({
                x: 0,
                y: 6,
                blur: 14,
                color: "rgba(124,58,237,0.35)",
              }),
              { borderRadius: 11 },
            ]}
          >
            <LinearGradient
              colors={["#7C3AED", "#4F6DF5"]}
              {...gradPoints(135)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SparkleIcon size={16} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12.5,
                color: tokens.ink1,
              }}
            >
              {t.demoCtaTitle}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9.5,
                color: tokens.ink2,
                marginTop: 2,
              }}
            >
              {t.demoCtaSub}
            </Text>
          </View>
          <ChevronRightIcon size={15} color={tokens.ink3} />
        </GlassCard>

        {/* 7. CTA «Войти через Google» (макет 2008–2011). */}
        <GlassCard
          radius={16}
          contentStyle={{
            padding: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
          }}
          onPress={() => setPhase("onboarding")}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor:
                scheme === "dark" ? "rgba(255,255,255,0.08)" : "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoogleIcon size={18} />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope800,
              fontSize: 12.5,
              color: tokens.ink1,
            }}
          >
            {t.withGoogle}
          </Text>
        </GlassCard>

        {/* 8. CTA «Войти через Apple» (макет 2012–2015). */}
        <GlassCard
          radius={16}
          contentStyle={{
            padding: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
          }}
          onPress={() => setPhase("onboarding")}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor:
                scheme === "dark" ? "rgba(255,255,255,0.08)" : "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppleIcon size={18} color={tokens.ink1} />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope800,
              fontSize: 12.5,
              color: tokens.ink1,
            }}
          >
            {t.withApple}
          </Text>
        </GlassCard>

        {/* 9. Legal disclaimer (макет 2016). */}
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
          <Text
            style={{ fontFamily: fonts.manrope800, color: tokens.accent }}
            onPress={() => setPhase("onboarding")}
          >
            {t.legalTerms}
          </Text>
          {t.legalAnd}
          <Text
            style={{ fontFamily: fonts.manrope800, color: tokens.accent }}
            onPress={() => setPhase("onboarding")}
          >
            {t.legalPrivacy}
          </Text>
        </Text>
      </ScrollView>

      <AuthHelpSheet visible={sheet === "help"} onClose={() => setSheet(null)} />
      <AuthDemoPickerSheet
        visible={sheet === "demo"}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

export default LoginPhoneScreen;
