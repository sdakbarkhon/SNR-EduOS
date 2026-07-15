import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useSelectedChild } from "../context/ParentDataContext";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import { loadHistory, type PaymentHistoryRecord } from "../lib/mockPaymentsData";
import type { MainStackParamList } from "../navigation/MainNavigator";

/** Промт МОБ-5, Экран 4 — История платежей (обновляется из Checkout). */
export default function PaymentHistoryScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const child = useSelectedChild();

  const history = useAsyncData<PaymentHistoryRecord[]>(
    () => (child ? loadHistory(child.id) : Promise.resolve([])),
    [child?.id],
  );

  const sorted = (history.data ?? []).slice().sort((a, b) => (a.paidAt > b.paidAt ? -1 : 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={history.refreshing} onRefresh={history.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.historyTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {history.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={history.refresh} />
          ) : history.loading ? (
            <ScreenSkeleton />
          ) : sorted.length === 0 ? (
            <EmptyState icon="receipt-outline" title={d.parentMobile.historyEmpty} description={d.parentMobile.comingSoonSection} />
          ) : (
            <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, ...shadow.soft }}>
              {sorted.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => nav.navigate("Receipt", { recordId: r.id })}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13,
                    borderBottomWidth: i < sorted.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="checkmark-circle-outline" size={19} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{r.title}</Text>
                    <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{formatDate(r.paidAt, locale)}</Text>
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: "800", color: colors.textPrimary }}>{r.amount.toLocaleString(locale)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
