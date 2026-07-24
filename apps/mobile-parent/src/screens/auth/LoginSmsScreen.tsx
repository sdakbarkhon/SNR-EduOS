/**
 * Заход 4a — LoginSmsScreen (макет layerA3, «SNR EduOS v2 Light.dc.html» стр. 2020–2043).
 * Строгий block-list (сверху вниз):
 *   1. Шапка (back + resend-таймер справа) — 50/18/8.
 *   2. Заголовок «Введите код\nиз SMS» — Unbounded 20/600.
 *   3. Subtitle «Мы отправили 4-значный код\nна номер {phone}».
 *   4. 4 бокса ввода кода (центрированы, gap 10).
 *   5. Security-стрип (glass, щит 32×32 + текст двумя строками).
 *   6. Spacer (flex:1) — прижимает клавиатуру к низу.
 *   7. Numeric keypad 3×4 (padKeys — 12 клавиш).
 *
 * Реальный таймер cooldown (45→0). Автоверификация при 4 цифрах (setTimeout 350ms).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts, shadowStyle } from "../../theme";
import { GlassCard, GlassCircleButton } from "../../ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { BackArrowIcon, BackspaceIcon, ShieldCheckIcon } from "../../ui/auth/icons";

const SMS_LEN = 4;
const RESEND_COOLDOWN = 45;
const AUTO_SUBMIT_DELAY = 350;

interface PadKey {
  d: string;
  l: string;
}

const PAD_KEYS: PadKey[] = [
  { d: "1", l: "" },
  { d: "2", l: "ABC" },
  { d: "3", l: "DEF" },
  { d: "4", l: "GHI" },
  { d: "5", l: "JKL" },
  { d: "6", l: "MNO" },
  { d: "7", l: "PQRS" },
  { d: "8", l: "TUV" },
  { d: "9", l: "WXYZ" },
  { d: "", l: "" },
  { d: "0", l: "" },
  { d: "del", l: "" },
];

export function LoginSmsScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    phone,
    country,
    smsCode,
    setSmsCode,
    verifyCode,
    setPhase,
    enterApp,
  } = useAuthSession();

  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // «+998 90 123 45 67» — формат тот же, что в LoginPhoneScreen.
  const phoneMasked = useMemo(() => {
    const parts = phone.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!parts) return `${country} ${phone || t.phonePlaceholder}`;
    const rest = [parts[1], parts[2], parts[3], parts[4]].filter(Boolean).join(" ");
    return `${country} ${rest || t.phonePlaceholder}`;
  }, [phone, country, t.phonePlaceholder]);

  // Таймер cooldown (макет — smsТ 45 → 0).
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown > 0]);

  // Автоверификация при 4 цифрах (setTimeout 350ms).
  useEffect(() => {
    if (smsCode.length !== SMS_LEN) return;
    autoSubmitRef.current = setTimeout(() => {
      const next = verifyCode();
      if (next === "app") enterApp(0);
    }, AUTO_SUBMIT_DELAY);
    return () => {
      if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    };
  }, [smsCode, verifyCode, enterApp]);

  const goBack = () => setPhase("phone");

  const smsResend = () => {
    if (cooldown > 0) return;
    setSmsCode("");
    setCooldown(RESEND_COOLDOWN);
  };

  const pressPad = (k: string) => {
    if (!k) return;
    if (k === "del") {
      setSmsCode(smsCode.slice(0, -1));
      return;
    }
    if (smsCode.length >= SMS_LEN) return;
    setSmsCode(smsCode + k);
  };

  const smsResendActive = cooldown === 0;
  const smsResendTxt = cooldown > 0
    ? t.smsResendCountdown.replace("{sec}", String(cooldown).padStart(2, "0"))
    : t.smsResend;

  // ── Токены цветов боксов / клавиш ─────────────────────────────────────────
  const glassBg = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const glassBorder = scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.8)";
  const activeBorder = "rgba(124,58,237,0.65)";

  return (
    <View style={{ flex: 1 }}>
      {/* ── БЛОК 1: Шапка (back + resend-таймер справа) ─────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={goBack}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
        <View style={{ flex: 1 }} />
        <Pressable onPress={smsResend} disabled={!smsResendActive} hitSlop={10}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: smsResendActive ? tokens.accent : tokens.ink3,
            }}
          >
            {smsResendTxt}
          </Text>
        </Pressable>
      </View>

      {/* ── flex:1 колонка контента (padding 8 20 0) ─────────────────────── */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: "column",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 8,
        }}
      >
        {/* ── БЛОК 2: Заголовок ──────────────────────────────────────────── */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 20,
            lineHeight: 27,
            color: tokens.ink1,
          }}
        >
          {t.smsTitle}
        </Text>

        {/* ── БЛОК 3: Subtitle ──────────────────────────────────────────── */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11.5,
            lineHeight: 17,
            color: tokens.ink2,
          }}
        >
          {t.smsSubPrefix}
          <Text style={{ fontFamily: fonts.manrope800, color: tokens.ink1 }}>{phoneMasked}</Text>
        </Text>

        {/* ── БЛОК 4: 4 бокса ввода кода ────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          {Array.from({ length: SMS_LEN }).map((_, i) => {
            const digit = smsCode[i] ?? "";
            const isActive = smsCode.length === i;
            return (
              <View
                key={i}
                style={[
                  {
                    width: 56,
                    height: 60,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: glassBg,
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? activeBorder : glassBorder,
                  },
                  shadowStyle(
                    isActive
                      ? { x: 0, y: 10, blur: 24, color: "rgba(124,58,237,0.2)" }
                      : { x: 0, y: 8, blur: 18, color: "rgba(99,86,214,0.1)" },
                  ),
                ]}
              >
                <Text
                  style={{
                    fontFamily: fonts.unbounded600,
                    fontSize: 20,
                    color: tokens.ink1,
                  }}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── БЛОК 5: Security-стрип (щит + текст двумя строками) ───────── */}
        <GlassCard
          radius={16}
          contentStyle={{
            padding: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(139,92,246,0.14)",
              borderWidth: 1,
              borderColor: "rgba(139,92,246,0.35)",
            }}
          >
            <ShieldCheckIcon size={15} color="#6D28D9" />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10.5,
              lineHeight: 16,
              color: tokens.ink2,
            }}
          >
            {t.smsSecurity}
          </Text>
        </GlassCard>

        {/* ── БЛОК 6: Spacer (flex:1) — прижимает клавиатуру ────────────── */}
        <View style={{ flex: 1 }} />

        {/* ── БЛОК 7: Numeric keypad 3×4 (padKeys, gap 8) ──────────────── */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 8,
            paddingBottom: Math.max(26, insets.bottom + 12),
          }}
        >
          {PAD_KEYS.map((k, i) => {
            const empty = k.d === "";
            const isDel = k.d === "del";
            return (
              <Pressable
                key={i}
                onPress={() => pressPad(k.d)}
                disabled={empty}
                style={{
                  width: "32%",
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: empty ? "transparent" : glassBg,
                  borderWidth: empty ? 0 : 1,
                  borderColor: glassBorder,
                  opacity: empty ? 0 : 1,
                }}
              >
                {isDel ? (
                  <BackspaceIcon size={20} color={tokens.ink1} />
                ) : (
                  <>
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 18,
                        lineHeight: 20,
                        color: tokens.ink1,
                      }}
                    >
                      {k.d}
                    </Text>
                    {k.l ? (
                      <Text
                        style={{
                          fontFamily: fonts.manrope800,
                          fontSize: 7.5,
                          letterSpacing: 0.6,
                          color: tokens.ink3,
                          marginTop: 1,
                        }}
                      >
                        {k.l}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default LoginSmsScreen;
