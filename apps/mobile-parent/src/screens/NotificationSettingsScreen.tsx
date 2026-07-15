import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { format } from "@snr/core";
import { useAppLocale } from "../i18n";
import { colors, radii, shadow, spacing } from "../theme";
import {
  loadNotificationSettings, saveNotificationSettings, loadQuietHours, saveQuietHours,
  type NotificationSettings, type QuietHours,
} from "../lib/mockProfileData";
import type { MainStackParamList } from "../navigation/MainNavigator";

const ROWS: { key: keyof NotificationSettings; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "grades", icon: "trophy-outline" },
  { key: "homework", icon: "document-text-outline" },
  { key: "attendance", icon: "checkmark-circle-outline" },
  { key: "announcements", icon: "megaphone-outline" },
  { key: "teacherMessages", icon: "chatbubble-ellipses-outline" },
  { key: "paymentReminders", icon: "card-outline" },
];

/** Промт МОБ-6, Экран 4 — Настройки уведомлений. Все переключатели и тихие
 *  часы персистятся через mockStorage.ts. */
export default function NotificationSettingsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [quiet, setQuiet] = useState<QuietHours | null>(null);

  useEffect(() => {
    loadNotificationSettings().then(setSettings);
    loadQuietHours().then(setQuiet);
  }, []);

  function toggle(key: keyof NotificationSettings) {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: !prev[key] };
      saveNotificationSettings(next);
      return next;
    });
  }

  function toggleQuiet() {
    setQuiet((prev) => {
      if (!prev) return prev;
      const next = { ...prev, enabled: !prev.enabled };
      saveQuietHours(next);
      return next;
    });
  }

  function setQuietTime(field: "from" | "to", value: string) {
    setQuiet((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      saveQuietHours(next);
      return next;
    });
  }

  const labelByKey: Record<keyof NotificationSettings, string> = {
    grades: d.parentMobile.notifSetGrades,
    homework: d.parentMobile.notifSetHomework,
    attendance: d.parentMobile.notifSetAttendance,
    announcements: d.parentMobile.notifSetAnnouncements,
    teacherMessages: d.parentMobile.notifSetTeacherMessages,
    paymentReminders: d.parentMobile.notifSetPayments,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable onPress={() => nav.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.notifSetTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {!settings || !quiet ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: spacing.lg, ...shadow.soft }}>
                {ROWS.map((row, i) => (
                  <View
                    key={row.key}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12,
                      borderBottomWidth: i < ROWS.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={row.icon} size={16} color={colors.primary} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{labelByKey[row.key]}</Text>
                    <Switch value={settings[row.key]} onToggle={() => toggle(row.key)} />
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, ...shadow.soft }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderBottomWidth: quiet.enabled ? 1 : 0, borderBottomColor: colors.border }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.chipBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{d.parentMobile.notifSetQuietHoursTitle}</Text>
                  <Switch value={quiet.enabled} onToggle={toggleQuiet} />
                </View>
                {quiet.enabled && (
                  <View style={{ paddingVertical: 12, gap: 8 }}>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      {format(d.parentMobile.notifSetQuietHoursDesc, { from: quiet.from, to: quiet.to })}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <TextInput
                        value={quiet.from}
                        onChangeText={(v) => setQuietTime("from", v)}
                        placeholder="22:00"
                        style={{ backgroundColor: colors.chipBg, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, width: 72, textAlign: "center" }}
                      />
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>—</Text>
                      <TextInput
                        value={quiet.to}
                        onChangeText={(v) => setQuietTime("to", v)}
                        placeholder="07:00"
                        style={{ backgroundColor: colors.chipBg, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, width: 72, textAlign: "center" }}
                      />
                    </View>
                  </View>
                )}
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
