/**
 * Вход 3 — LoginSmsScreen (макет layerA3, строки 2020–2043 «SNR EduOS v2 Light.dc.html»).
 * Шапка (back + «Отправить снова (00:XX)»), заголовок, 4 бокса кода,
 * security-стрип, своя цифровая клавиатура 3×4 (padKeys, макет 4257).
 * Реальный таймер обратного отсчёта (45→0), useEffect+setInterval.
 * Автоверификация после ввода 4-й цифры (fixed accept '1234' — демо).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts, shadowStyle } from "../../theme";
import { GlassCard, GlassCircleButton } from "../../ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { BackArrowIcon, BackspaceIcon, ShieldCheckIcon } from "../../ui/auth/icons";

const SMS_LEN = 4;
const RESEND_COOLDOWN = 45;
const AUTO_SUBMIT_DELAY = 350;

const PAD_KEYS: { d: string; letters: string }[] = [
  { d: "1", letters: "" },
  { d: "2", letters: "ABC" },
  { d: "3", letters: "DEF" },
  { d: "4", letters: "GHI" },
  { d: "5", letters: "JKL" },
  { d: "6", letters: "MNO" },
  { d: "7", letters: "PQRS" },
  { d: "8", letters: "TUV" },
  { d: "9", letters: "WXYZ" },
  { d: "", letters: "" },
  { d: "0", letters: "" },
  { d: "del", letters: "" },
];

export function LoginSmsScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { phone, country, smsCode, setSmsCode, verifyCode, setPhase, enterApp } = useAuthSession();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phoneMasked = useMemo(() => {
    const parts = phone.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!parts) return `${country} ${phone || t.phonePlaceholder}`;
    const rest = [parts[1], parts[2], parts[3], parts[4]].filter(Boolean).join(" ");
    return `${country} ${rest || t.phonePlaceholder}`;
  }, [phone, country, t.phonePlaceholder]);

  // Таймер cooldown (макет: смsТ 45 в state, у нас — тикает)
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown > 0]);

  // Автоверификация при 4 цифрах — макет строка 3767 через setTimeout 350ms
  useEffect(() => {
    if (smsCode.length !== SMS_LEN) return;
    autoSubmitRef.current = setTimeout(() => {
      // Демо: принимаем любой ввод (реальный код будет позже).
      const next = verifyCode();
      if (next === "app") {
        enterApp(0);
      }
    }, AUTO_SUBMIT_DELAY);
    return () => {
      if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    };
  }, [smsCode, verifyCode, enterApp]);

  function pressKey(k: string) {
    if (k === "") return;
    if (k === "del") {
      setSmsCode(smsCode.slice(0, -1));
      return;
    }
    if (smsCode.length >= SMS_LEN) return;
    setSmsCode(smsCode + k);
  }

  function resend() {
    if (cooldown > 0) return;
    setSmsCode("");
    setCooldown(RESEND_COOLDOWN);
  }

  const resendLabel = cooldown > 0
    ? t.smsResendCountdown.replace("{sec}", String(cooldown).padStart(2, "0"))
    : t.smsResend;

  return (
    <View style={{ flex: 1 }}>
      {/* Шапка A3 — back + text-link «Отправить снова» */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => setPhase("phone")}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
        <View style={{ flex: 1 }} />
        <Pressable onPress={resend} disabled={cooldown > 0} hitSlop={8}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: cooldown > 0 ? tokens.ink3 : tokens.accent,
            }}
          >
            {resendLabel}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 0,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, lineHeight: 27, color: tokens.ink1 }}>
          {t.smsTitle}
        </Text>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 17, color: tokens.ink2 }}>
          {t.smsSubPrefix}
          <Text style={{ fontFamily: fonts.manrope800, color: tokens.ink1 }}>{phoneMasked}</Text>
        </Text>

        {/* 4 ячейки кода */}
        <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 6 }}>
          {Array.from({ length: SMS_LEN }).map((_, i) => {
            const filled = smsCode[i] ?? "";
            const active = smsCode.length === i;
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
                    backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
                    borderWidth: active ? 2 : 1,
                    borderColor: active
                      ? "rgba(124,58,237,0.65)"
                      : scheme === "dark"
                      ? "rgba(255,255,255,0.16)"
                      : "rgba(255,255,255,0.8)",
                  },
                  shadowStyle(
                    active
                      ? { x: 0, y: 10, blur: 24, color: "rgba(124,58,237,0.2)" }
                      : { x: 0, y: 8, blur: 18, color: "rgba(99,86,214,0.1)" },
                  ),
                ]}
              >
                <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, color: tokens.ink1 }}>{filled}</Text>
              </View>
            );
          })}
        </View>

        {/* Security-стрип — макет 2033 */}
        <GlassCard
          radius={16}
          contentStyle={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(139,92,246,0.14)",
              borderWidth: 1,
              borderColor: "rgba(139,92,246,0.35)",
            }}
          >
            <ShieldCheckIcon size={16} color="#6D28D9" />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 10.5, lineHeight: 15, color: tokens.ink2 }}>
            {t.smsSecurity}
          </Text>
        </GlassCard>
      </ScrollView>

      {/* Numeric keypad (клавиатура 3×4) — прижата к низу */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(26, insets.bottom + 12),
          paddingTop: 12,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }}>
          {PAD_KEYS.map((k, i) => {
            const empty = k.d === "";
            const isDel = k.d === "del";
            return (
              <Pressable
                key={i}
                onPress={() => pressKey(k.d)}
                disabled={empty}
                style={{
                  width: "32%",
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: empty
                    ? "transparent"
                    : scheme === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.55)",
                  borderWidth: empty ? 0 : 1,
                  borderColor: scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.8)",
                  opacity: empty ? 0 : 1,
                }}
              >
                {isDel ? (
                  <BackspaceIcon size={20} color={tokens.ink1} />
                ) : (
                  <>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 18, color: tokens.ink1, lineHeight: 20 }}>
                      {k.d}
                    </Text>
                    {k.letters ? (
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 7.5, letterSpacing: 0.6, color: tokens.ink3, marginTop: 1 }}>
                        {k.letters}
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
