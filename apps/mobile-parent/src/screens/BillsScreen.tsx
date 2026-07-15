import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDate, format, isOverdue } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useSelectedChild } from "../context/ParentDataContext";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import { loadBills, type Bill } from "../lib/mockPaymentsData";
import type { MainStackParamList } from "../navigation/MainNavigator";

/** Промт МОБ-5, Экран 2 — Счета к оплате (mock-flat список, тап → Checkout). */
export default function BillsScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const child = useSelectedChild();

  const bills = useAsyncData<Bill[]>(
    () => (child ? loadBills(child.id, child.className ?? "") : Promise.resolve([])),
    [child?.id],
  );

  const sorted = (bills.data ?? []).slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={bills.refreshing} onRefresh={bills.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.billsTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {bills.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={bills.refresh} />
          ) : bills.loading ? (
            <ScreenSkeleton />
          ) : sorted.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title={d.parentMobile.billsEmpty} description={d.parentMobile.comingSoonSection} />
          ) : (
            <View style={{ gap: 10 }}>
              {sorted.map((bill) => {
                const overdue = isOverdue(bill.dueDate);
                return (
                  <Pressable
                    key={bill.id}
                    onPress={() => nav.navigate("Checkout", { bill })}
                    style={({ pressed }) => [{
                      backgroundColor: colors.card, borderRadius: radii.xl, padding: 14,
                      flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                    }]}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: overdue ? colors.dangerBg : colors.chipBg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={overdue ? "alert-circle-outline" : "document-text-outline"} size={20} color={overdue ? colors.danger : colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{bill.title}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                          {format(d.parentMobile.billsDueLabel, { date: formatDate(bill.dueDate, locale) })}
                        </Text>
                        {overdue && (
                          <View style={{ backgroundColor: colors.dangerBg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
                            <Text style={{ fontSize: 9.5, fontWeight: "800", color: colors.danger }}>{d.parentMobile.payOverdueTag}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textPrimary }}>{bill.amount.toLocaleString(locale)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
