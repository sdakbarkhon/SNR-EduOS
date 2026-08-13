/**
 * Вход 2 — LoginPhoneScreen (макет layerA2, «SNR EduOS v2 Light.dc.html» 1972–2018).
 *
 * Состав экрана (сверху вниз), после уборки 13.08.2026:
 *   1. Шапка: back (GlassCircleButton) + text-link «Нужна помощь?».
 *   2. Заголовок Unbounded 20/600 «Добро пожаловать\nв SNR EduOS!».
 *   3. Subtitle 12/600 «Войдите в аккаунт, чтобы продолжить».
 *   4. GlassCard с caps-label «НОМЕР ТЕЛЕФОНА», country-picker + phone input,
 *      кнопка «Продолжить» (PrimaryButton, disabled пока цифр < 9).
 *   5. Правовые ссылки — открывают документ, если его адрес задан в сборке.
 *
 * УБРАНО 13.08.2026: разделитель «или», «Войти через Google», «Войти через
 * Apple». Все три из макета, но входа через сторонние учётные записи у нас
 * нет: обе кнопки возвращали на онбординг. Родитель входит по номеру телефона
 * с одноразовым кодом — это единственный путь, и теперь он единственный на
 * экране. Иконки GoogleIcon/AppleIcon удалены из ui/auth/icons.tsx следом:
 * других потребителей у них не было.
 */
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
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
  BackArrowIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparkleIcon,
  UzFlagIcon,
} from "../../ui/auth/icons";
import { AuthHelpSheet } from "./sheets/AuthHelpSheet";
import { LangThemeButtons } from "./LangThemeButtons";

/**
 * Правовые документы. Ссылки обязаны быть — их требуют магазины, — но вести
 * в никуда они не могут. Поэтому адрес берётся из настроек сборки
 * (`app.json → expo.extra.legalTermsUrl / legalPrivacyUrl`): как только
 * заказчик даст ссылки, они заработают без единой правки кода. Пока адреса
 * нет, вместо перехода показывается честное объяснение, а не молчаливый
 * возврат на онбординг, как было до 13.08.2026.
 */
function legalUrl(kind: "terms" | "privacy"): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const raw = extra?.[kind === "terms" ? "legalTermsUrl" : "legalPrivacyUrl"];
  return typeof raw === "string" && raw.startsWith("http") ? raw : null;
}

/** Формат «90 123 45 67» — соответствует phoneFmt макета. */
function formatPhone(digits: string): string {
  const m = digits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
  if (!m) return digits;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}

type SheetKey = null | "help";

export function LoginPhoneScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { country, phone, setCountry, setPhone, submitPhone, setPhase, phoneError } =
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

  /** Открыть документ, если адрес задан в сборке; иначе честно объяснить. */
  function openLegal(kind: "terms" | "privacy") {
    const url = legalUrl(kind);
    if (url) { void Linking.openURL(url); return; }
    Alert.alert(
      kind === "terms" ? t.legalTerms.trim() : t.legalPrivacy.trim(),
      t.legalNotReady,
    );
  }
  // Заход 1: существующего компонента ошибки на этом экране не было
  // (фикстурный вход не мог провалиться) — переиспользуем семантический
  // токен status.red, как и на LoginSmsScreen.
  const errorColor = tokens.status.red.text;
  // Причина приходит машинным кодом с сервера — переводим её в фразу здесь,
  // чтобы в словаре не заводить ключи со снейк-кейсом.
  const PHONE_ERROR_TEXT: Record<string, string> = {
    not_found: t.phoneNotFound,
    invalidPhone: t.phoneInvalid,
    too_soon: t.phoneTooSoon,
    no_account: t.phoneNoAccount,
    config_error: t.configError,
    network_error: t.networkError,
  };
  const phoneErrorText = phoneError ? (PHONE_ERROR_TEXT[phoneError] ?? t.networkError) : null;

  return (
    <View style={{ flex: 1 }}>
      {/* 1. Шапка — back слева, Язык/Тема + «Нужна помощь?» справа (макет 1973–1977). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => setPhase("onboarding")}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
        <View style={{ flex: 1 }} />
        <LangThemeButtons />
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
                borderWidth: phoneError ? 2 : 1,
                borderColor: phoneError ? errorColor : inputBorder,
              }}
              maxLength={12}
            />
          </View>
          {/* Заход 1: "Номер не найден" — вне block-list макета (фикстурный
              вход не мог провалиться), минимальный inline-Text на status.red. */}
          {phoneErrorText ? (
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 10.5,
                color: errorColor,
                marginTop: 6,
              }}
            >
              {phoneErrorText}
            </Text>
          ) : null}
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

        {/* Разделитель «или» и входы через Google и Apple убраны 13.08.2026.
            Обе кнопки никуда не вели: их onPress возвращал на онбординг, а
            входа через сторонние учётные записи у нас нет и не планируется —
            родитель входит по номеру телефона с одноразовым кодом. Вместе с
            ними ушёл и разделитель: разделять стало нечего. */}

        {/* Правовые ссылки (макет 2016). */}
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
            onPress={() => openLegal("terms")}
          >
            {t.legalTerms}
          </Text>
          {t.legalAnd}
          <Text
            style={{ fontFamily: fonts.manrope800, color: tokens.accent }}
            onPress={() => openLegal("privacy")}
          >
            {t.legalPrivacy}
          </Text>
        </Text>
      </ScrollView>

      <AuthHelpSheet visible={sheet === "help"} onClose={() => setSheet(null)} />
    </View>
  );
}

export default LoginPhoneScreen;
