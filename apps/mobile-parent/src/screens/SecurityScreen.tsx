import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTime, format } from "@snr/core";
import { useAppLocale } from "../i18n";
import { colors, radii, shadow, spacing } from "../theme";
import {
  loadBiometricEnabled, saveBiometricEnabled, loadPinEnabled, savePinEnabled, savePinHash,
  MOCK_ACTIVE_SESSIONS, MOCK_LOGIN_HISTORY, type MockSession,
} from "../lib/mockProfileData";
import type { MainStackParamList } from "../navigation/MainNavigator";

/** Промт МОБ-6, Экран 6 — Безопасность. expo-local-authentication нет в
 *  собранном APK/Expo Go (не тянуть тяжёлый native-модуль ради OTA-фикса) —
 *  по явному разрешению ТЗ Face ID/Touch ID здесь mock-переключатель без
 *  реальной биометрии. PIN — тоже мок (принимает любые 4 цифры, хранится в
 *  открытом виде через mockStorage — см. TODO в mockProfileData.ts). */
export default function SecurityScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [biometric, setBiometric] = useState<boolean | null>(null);
  const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);
  const [pinStage, setPinStage] = useState<null | "create1" | "create2">(null);
  const [firstPin, setFirstPin] = useState("");
  const [sessions, setSessions] = useState<MockSession[]>(MOCK_ACTIVE_SESSIONS);

  useEffect(() => {
    loadBiometricEnabled().then(setBiometric);
    loadPinEnabled().then(setPinEnabled);
  }, []);

  function onToggleBiometric() {
    setBiometric((prev) => {
      const next = !prev;
      saveBiometricEnabled(next);
      return next;
    });
  }

  function onTogglePin() {
    if (pinEnabled) {
      setPinEnabled(false);
      savePinEnabled(false);
    } else {
      setPinStage("create1");
    }
  }

  function onPinDigits(digits: string) {
    if (pinStage === "create1") {
      setFirstPin(digits);
      setPinStage("create2");
    } else if (pinStage === "create2") {
      if (digits !== firstPin) {
        Alert.alert(d.parentMobile.secPinMismatch);
        setPinStage("create1");
        setFirstPin("");
        return;
      }
      savePinHash(digits);
      savePinEnabled(true);
      setPinEnabled(true);
      setPinStage(null);
      setFirstPin("");
    }
  }

  function onEndSession(session: MockSession) {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    Alert.alert(d.parentMobile.secSessionEndedNotice);
  }

  if (pinStage) {
    return (
      <PinEntryScreen
        title={pinStage === "create1" ? d.parentMobile.secPinCreateTitle : d.parentMobile.secPinRepeatTitle}
        onCancel={() => { setPinStage(null); setFirstPin(""); }}
        onComplete={onPinDigits}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable onPress={() => nav.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.secTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {biometric == null || pinEnabled == null ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: spacing.lg, ...shadow.soft }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="finger-print-outline" size={17} color={colors.primary} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{d.parentMobile.secBiometricRow}</Text>
                  {biometric && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.success }}>{d.parentMobile.secBiometricEnabled}</Text>
                    </View>
                  )}
                  <Switch value={biometric} onToggle={onToggleBiometric} />
                </View>
                <View style={{ paddingVertical: 13 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="keypad-outline" size={17} color={colors.primary} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{d.parentMobile.secPinRow}</Text>
                    <Switch value={pinEnabled} onToggle={onTogglePin} />
                  </View>
                  {pinEnabled && (
                    <Pressable onPress={() => setPinStage("create1")} style={{ marginTop: 10, alignSelf: "flex-start" }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{d.parentMobile.secPinChangeBtn}</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                {d.parentMobile.secSessionsTitle}
              </Text>
              <View style={{ gap: 8, marginBottom: spacing.lg }}>
                {sessions.map((s) => (
                  <View key={s.id} style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 13, flexDirection: "row", alignItems: "center", gap: 11, ...shadow.soft }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: s.activeLabel === "now" ? colors.successBg : colors.chipBg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="phone-portrait-outline" size={17} color={s.activeLabel === "now" ? colors.success : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{s.device}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        {`${s.location} — ${s.activeLabel === "now" ? d.parentMobile.secSessionActiveNow : format(d.parentMobile.secSessionDaysAgo, { n: s.daysAgo ?? 0 })}`}
                      </Text>
                    </View>
                    {s.activeLabel !== "now" && (
                      <Pressable onPress={() => onEndSession(s)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                        <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.danger }}>{d.parentMobile.secSessionEndBtn}</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                {d.parentMobile.secLoginHistoryTitle}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, ...shadow.soft }}>
                {MOCK_LOGIN_HISTORY.map((r, i) => (
                  <View
                    key={r.id}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: i < MOCK_LOGIN_HISTORY.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
                  >
                    <Text style={{ fontSize: 12.5, color: colors.textPrimary, fontWeight: "600" }}>{r.device}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatDateTime(r.date, locale)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Switch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? colors.primary : colors.border, justifyContent: "center" }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", marginLeft: value ? 21 : 3 }} />
    </Pressable>
  );
}

function PinEntryScreen({ title, onCancel, onComplete }: { title: string; onCancel: () => void; onComplete: (digits: string) => void }) {
  const [digits, setDigits] = useState("");

  function onDigit(n: string) {
    if (digits.length >= 4) return;
    const next = digits + n;
    setDigits(next);
    if (next.length === 4) {
      setTimeout(() => onComplete(next), 150);
    }
  }
  function onBackspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.lg }}>
          <Pressable onPress={onCancel} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textPrimary, marginBottom: 24 }}>{title}</Text>
          <View style={{ flexDirection: "row", gap: 14, marginBottom: 40 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: i < digits.length ? colors.primary : colors.chipBg,
                  borderWidth: i < digits.length ? 0 : 1.5, borderColor: colors.border,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", width: 240, justifyContent: "center", gap: 16 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) =>
              key === "" ? (
                <View key={i} style={{ width: 60, height: 60 }} />
              ) : (
                <Pressable
                  key={i}
                  onPress={() => (key === "⌫" ? onBackspace() : onDigit(key))}
                  style={({ pressed }) => [{
                    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.card,
                    alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1, ...shadow.soft,
                  }]}
                >
                  <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary }}>{key}</Text>
                </Pressable>
              ),
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
