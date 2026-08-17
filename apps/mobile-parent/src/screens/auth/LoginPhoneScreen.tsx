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
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { legalUrl } from "../../lib/legal";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  GlassCard,
  GlassCircleButton,
  Popover,
  PrimaryButton,
} from "../../ui";
import { getAuthFixtures } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { isGoogleLoginAvailable } from "../../lib/parentGoogleLogin";
import {
  BackArrowIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparkleIcon,
  UzFlagIcon,
} from "../../ui/auth/icons";
import { AuthHelpSheet } from "./sheets/AuthHelpSheet";
import { LangThemeButtons } from "./LangThemeButtons";

/** Формат «90 123 45 67» — соответствует phoneFmt макета. */
function formatPhone(digits: string): string {
  const m = digits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
  if (!m) return digits;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}

type SheetKey = null | "help";

/* ── Вход через стороннюю учётную запись ──────────────────────────────────── */

/** Фирменный глиф Google — четыре цветных сектора, цвета их, не наши. */
function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.4-4.9 3.4-8.4z" fill="#4285F4" />
      <Path d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 20.5 7.5 23 12 23z" fill="#34A853" />
      <Path d="M5.6 13.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3v-3H1.8C1 7.8.5 9.8.5 11.5s.5 3.7 1.3 5.3l3.8-3z" fill="#FBBC05" />
      <Path d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15.1.5 12 .5 7.5.5 3.7 3 1.8 6.5l3.8 3c.9-2.7 3.4-4.5 6.4-4.5z" fill="#EA4335" />
    </Svg>
  );
}

/** Глиф Apple. Лежит на белой плитке, поэтому цвет жёстко тёмный. */
function AppleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M17.6 12.5c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3.1.7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.7zM15.6 6c.6-.7 1-1.7.9-2.6-.8 0-1.9.5-2.4 1.2-.5.6-1 1.6-.8 2.6.9.1 1.8-.5 2.3-1.2z"
        fill="#171243"
      />
    </Svg>
  );
}

/** Кнопка входа через сторонний аккаунт. Без пометки «скоро» — рабочая:
 *  видом не отличаться от неактивной она не должна. */
function SocialButton({
  label,
  badge,
  glyph,
  onPress,
  disabled,
}: {
  label: string;
  badge?: string;
  glyph: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          backgroundColor: tokens.chip(tokens.status.gray.rgb).bg,
          // Рабочая кнопка не приглушается — приглушены только те, что с пометкой.
          opacity: pressed ? 0.5 : badge ? 0.65 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        {glyph}
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
        {label}
      </Text>
      {badge ? (
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>{badge}</Text>
      ) : null}
    </Pressable>
  );
}

export function LoginPhoneScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { country, phone, setCountry, setPhone, submitPhone, setPhase, phoneError,
    signInWithGoogle, googleBusy, googleError } = useAuthSession();
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

  // Отказы входа через Google — те же четыре причины, что на вебе, плюс
  // «здесь так нельзя» для Expo Go. «Отмена» в карту не входит: контекст
  // гасит её в null, показывать нечего.
  const GOOGLE_ERROR_TEXT: Record<string, string> = {
    not_linked: t.googleNotLinked,
    no_account: t.googleNoAccount,
    school_archived: t.googleSchoolArchived,
    failed: t.googleFailed,
    expo_go: t.googleWebOnly,
    config_error: t.configError,
  };
  const googleErrorText = googleError ? (GOOGLE_ERROR_TEXT[googleError] ?? t.googleFailed) : null;

  // В Expo Go возврата по схеме приложения не бывает — там кнопка не молчит,
  // а объясняет и отправляет в браузерную версию.
  const googleReady = isGoogleLoginAvailable();

  function onGooglePress() {
    if (!googleReady) { Alert.alert(t.withGoogle, t.googleWebOnly); return; }
    void signInWithGoogle();
  }

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

        {/* Вход через Google и Apple. Google в проекте уже включён и работает
            в браузерной версии кабинета, но НЕ здесь: возврат из браузера в
            приложение идёт по своей схеме (snreduosparent://), а Expo Go такие
            схемы не поддерживает — там только exp://. Пока приложение живёт в
            Expo Go, кнопка честно отправляет в браузер. Apple не подключён
            вовсе. Молчания нет — по нажатию появляется объяснение. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: tokens.ink3, opacity: 0.35 }} />
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink3 }}>{t.or}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: tokens.ink3, opacity: 0.35 }} />
        </View>

        <SocialButton
          label={googleBusy ? t.googleSigningIn : t.withGoogle}
          badge={googleReady ? undefined : t.soonBadge}
          glyph={<GoogleGlyph />}
          onPress={onGooglePress}
          disabled={googleBusy}
        />
        {googleErrorText && (
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 16, color: errorColor, paddingHorizontal: 4 }}>
            {googleErrorText}
          </Text>
        )}
        <SocialButton
          label={t.withApple}
          badge={t.soonBadge}
          glyph={<AppleGlyph />}
          onPress={() => Alert.alert(t.withApple, t.appleSoon)}
        />

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
