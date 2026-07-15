import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { formatDate, format } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import { loadBalance, loadBills, loadHistory, type Bill, type PaymentHistoryRecord } from "../lib/mockPaymentsData";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

type Overview = { balance: number; bills: Bill[]; history: PaymentHistoryRecord[] };

/** Промт МОБ-5, Экран 1 — Оплаты/Баланс. Заменяет прежний placeholder (мок
 *  "80 000"/"120 000" сумм без действий) на mock-interactive экран с
 *  реальным child-контекстом: баланс/счета/история персистятся через
 *  mockStorage.ts (см. TODO(payments) в старой версии этого файла). */
export default function PaymentsScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, selectChild } = useParentData();
  const child = useSelectedChild();

  const overview = useAsyncData<Overview | null>(
    async () => {
      if (!child) return null;
      const [balance, bills, history] = await Promise.all([
        loadBalance(child.id),
        loadBills(child.id, child.className ?? ""),
        loadHistory(child.id),
      ]);
      return { balance, bills, history };
    },
    [child?.id],
  );

  function onSwitchChild() {
    if (!parentCtx || parentCtx.children.length <= 1) return;
    Alert.alert(
      d.parentUi.classesLabel,
      undefined,
      parentCtx.children.map((c) => ({
        text: `${c.fullName}${c.className ? ` — ${c.className}` : ""}`,
        onPress: () => selectChild(c.id),
      })),
    );
  }

  const nearestBill = (overview.data?.bills ?? [])
    .slice()
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0] ?? null;
  const recentHistory = (overview.data?.history ?? []).slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={overview.refreshing} onRefresh={overview.refresh} tintColor={colors.primary} />}
        >
          <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, marginBottom: 16, letterSpacing: -0.4 }}>{d.nav.payments}</Text>

          {!child ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : overview.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={overview.refresh} />
          ) : overview.loading || !overview.data ? (
            <ScreenSkeleton />
          ) : (
            <>
              {parentCtx && parentCtx.children.length > 1 && (
                <View
                  style={{
                    backgroundColor: colors.card, borderRadius: radii.lg, paddingVertical: 11, paddingHorizontal: 13,
                    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md, ...shadow.soft,
                  }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{initials(child.fullName)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: colors.textPrimary }}>{child.fullName}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted, marginTop: 1 }}>{child.className ?? d.common.none}</Text>
                  </View>
                  <Pressable
                    onPress={onSwitchChild}
                    style={({ pressed }) => [{ backgroundColor: colors.chipBg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>{d.parentMobile.switchChildBtn}</Text>
                  </Pressable>
                </View>
              )}

              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: radii.xxl, padding: 18, marginBottom: spacing.md }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 6 }}>{d.parentMobile.payBalanceTitle}</Text>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 }}>
                  {`${overview.data.balance.toLocaleString(locale)} ${d.parentMobile.sumCurrency}`}
                </Text>
              </LinearGradient>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.lg }}>
                <QuickAction icon="add-circle-outline" label={d.parentMobile.payTopUpBtn} onPress={() => nav.navigate("ChildWallet")} />
                <QuickAction icon="card-outline" label={d.parentMobile.payPayBillBtn} onPress={() => nav.navigate("Bills")} />
                <QuickAction icon="time-outline" label={d.parentMobile.payHistoryBtn} onPress={() => nav.navigate("PaymentHistory")} />
              </View>

              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 10, letterSpacing: -0.2 }}>
                {d.parentMobile.payNearestTitle}
              </Text>
              {nearestBill ? (
                <Pressable
                  onPress={() => nav.navigate("Checkout", { bill: nearestBill })}
                  style={({ pressed }) => [{
                    backgroundColor: colors.card, borderRadius: radii.xl, padding: 14, marginBottom: spacing.lg,
                    flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.warningBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{nearestBill.title}</Text>
                    <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                      {format(d.parentMobile.payDueLabel, { date: formatDate(nearestBill.dueDate, locale) })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textPrimary }}>{nearestBill.amount.toLocaleString(locale)}</Text>
                </Pressable>
              ) : (
                <View style={{ marginBottom: spacing.lg }}>
                  <EmptyState icon="checkmark-done-outline" title={d.parentMobile.payNearestNone} description={d.parentMobile.billsEmpty} />
                </View>
              )}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 }}>{d.parentMobile.payRecentTitle}</Text>
                <Pressable onPress={() => nav.navigate("PaymentHistory")}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{d.parentMobile.progSeeMore}</Text>
                </Pressable>
              </View>
              {recentHistory.length === 0 ? (
                <EmptyState icon="receipt-outline" title={d.parentMobile.payRecentEmpty} description={d.parentMobile.comingSoonSection} />
              ) : (
                <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, ...shadow.soft }}>
                  {recentHistory.map((r, i) => (
                    <Pressable
                      key={r.id}
                      onPress={() => nav.navigate("Receipt", { recordId: r.id })}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12,
                        borderBottomWidth: i < recentHistory.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{r.title}</Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{formatDate(r.paidAt, locale)}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>{r.amount.toLocaleString(locale)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flex: 1, backgroundColor: colors.card, borderRadius: radii.xl, paddingVertical: 13,
        alignItems: "center", gap: 6, opacity: pressed ? 0.85 : 1, ...shadow.soft,
      }]}
    >
      <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: "700", color: colors.textPrimary, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}
