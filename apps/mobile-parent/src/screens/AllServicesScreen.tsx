import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAppLocale } from "../i18n";
import { useSelectedChild } from "../context/ParentDataContext";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";
import type { Dictionary } from "@snr/core";

type ServiceItem = {
  key: string;
  label: (d: Dictionary) => string;
  subtitle: (d: Dictionary) => string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  active: boolean;
};

const SERVICES: ServiceItem[] = [
  { key: "payments", label: (d) => d.parentMobile.allServicesPaymentsLabel, subtitle: (d) => d.parentMobile.allServicesPaymentsSubtitle, icon: "card-outline", bg: "#EAF2FF", color: "#2E7DFF", active: true },
  { key: "schedule", label: (d) => d.parentMobile.allServicesScheduleLabel, subtitle: (d) => d.parentMobile.allServicesScheduleSubtitle, icon: "calendar-outline", bg: colors.successBg, color: colors.success, active: true },
  { key: "homework", label: (d) => d.parentMobile.allServicesHomeworkLabel, subtitle: (d) => d.parentMobile.allServicesHomeworkSubtitle, icon: "clipboard-outline", bg: colors.warningBg, color: colors.warning, active: true },
  { key: "grades", label: (d) => d.parentMobile.allServicesGradesLabel, subtitle: (d) => d.parentMobile.allServicesGradesSubtitle, icon: "star-outline", bg: "#FFF6DD", color: "#D9A400", active: true },
  { key: "attendance", label: (d) => d.parentMobile.allServicesAttendanceLabel, subtitle: (d) => d.parentMobile.allServicesAttendanceSubtitle, icon: "person-outline", bg: "#F1EBFF", color: colors.primary, active: true },
  { key: "messages", label: (d) => d.parentMobile.allServicesMessagesLabel, subtitle: (d) => d.parentMobile.allServicesMessagesSubtitle, icon: "chatbubble-outline", bg: "#FFE9EE", color: colors.accentCoral, active: true },
  { key: "dailyStatus", label: (d) => d.parentMobile.allServicesDailyStatusLabel, subtitle: (d) => d.parentMobile.allServicesDailyStatusSubtitle, icon: "pulse-outline", bg: "#E0F7FC", color: "#00B8D9", active: true },
  { key: "insight", label: (d) => d.parentMobile.allServicesInsightLabel, subtitle: (d) => d.parentMobile.allServicesInsightSubtitle, icon: "sparkles-outline", bg: "#FFF3E4", color: colors.accentOrange, active: true },
  { key: "transport", label: (d) => d.parentMobile.allServicesTransportLabel, subtitle: (d) => d.parentMobile.allServicesTransportSubtitle, icon: "bus-outline", bg: colors.chipBg, color: colors.textSecondary, active: false },
  { key: "cafeteria", label: (d) => d.parentMobile.allServicesCafeteriaLabel, subtitle: (d) => d.parentMobile.allServicesCafeteriaSubtitle, icon: "restaurant-outline", bg: colors.chipBg, color: colors.textSecondary, active: false },
  { key: "medical", label: (d) => d.parentMobile.allServicesMedicalLabel, subtitle: (d) => d.parentMobile.allServicesMedicalSubtitle, icon: "heart-outline", bg: colors.chipBg, color: colors.textSecondary, active: false },
  { key: "clubs", label: (d) => d.parentMobile.allServicesClubsLabel, subtitle: (d) => d.parentMobile.allServicesClubsSubtitle, icon: "musical-notes-outline", bg: colors.chipBg, color: colors.textSecondary, active: false },
  { key: "library", label: (d) => d.parentMobile.allServicesLibraryLabel, subtitle: (d) => d.parentMobile.allServicesLibrarySubtitle, icon: "book-outline", bg: colors.chipBg, color: colors.textSecondary, active: false },
  { key: "support", label: (d) => d.parentMobile.allServicesSupportLabel, subtitle: (d) => d.parentMobile.allServicesSupportSubtitle, icon: "headset-outline", bg: colors.chipBg, color: colors.textSecondary, active: true },
];

/** Промт МОБ-7, v10 — Все сервисы. Сетка 2 колонки; неактивные карточки ведут
 *  на общий ComingSoonScreen (параметризован названием/иконкой), активные —
 *  на уже существующие экраны платформы. */
export default function AllServicesScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const child = useSelectedChild();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SERVICES;
    return SERVICES.filter((s) => s.label(d).toLowerCase().includes(q));
  }, [query, d]);

  function onPress(item: ServiceItem) {
    if (!item.active) {
      nav.navigate("ComingSoon", { service: item.label(d), icon: item.icon });
      return;
    }
    switch (item.key) {
      case "payments": nav.getParent()?.navigate("Payments" as never); return;
      case "schedule": nav.navigate("Schedule"); return;
      case "homework": nav.navigate("Homework"); return;
      case "grades": nav.getParent()?.navigate("Progress" as never); return;
      case "attendance": if (child) nav.navigate("AttendanceDetail", { childId: child.id }); return;
      case "messages": nav.getParent()?.navigate("Messages" as never); return;
      case "dailyStatus": nav.navigate("DailyStatus"); return;
      case "insight": nav.navigate("Insight"); return;
      case "support": nav.navigate("Support"); return;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.allServicesTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, height: 44, marginBottom: spacing.lg, ...shadow.soft }}>
            <Ionicons name="search-outline" size={17} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={d.parentMobile.allServicesSearchPlaceholder}
              placeholderTextColor={colors.textFaint}
              style={{ flex: 1, marginLeft: 9, fontSize: 13, color: colors.textPrimary }}
            />
          </View>

          {filtered.length === 0 ? (
            <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, marginTop: 20 }}>{d.parentMobile.allServicesSearchEmpty}</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {filtered.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => onPress(item)}
                  style={({ pressed }) => [{
                    width: "48%", backgroundColor: colors.card, borderRadius: radii.xl, padding: 14,
                    opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: item.bg, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 3 }}>{item.label(d)}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 10.5, color: colors.textMuted }}>{item.subtitle(d)}</Text>
                  {!item.active && (
                    <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: colors.chipBg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 8.5, fontWeight: "800", color: colors.textMuted }}>{d.parentMobile.comingSoonTag}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
