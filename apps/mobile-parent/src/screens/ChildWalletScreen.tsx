import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useParentData } from "../context/ParentDataContext";
import { ScreenSkeleton, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import { loadWallet, type WalletState } from "../lib/mockPaymentsData";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Промт МОБ-5, Экран 6 — Кошелёк ребёнка. Список детей реальный
 *  (ParentDataContext), детали покупок — mock-flat, "Пополнить кошелёк" —
 *  mock-успех без реального flow (по ТЗ). Детали открываются внутри этого же
 *  экрана (локальный стейт), без отдельного роута — тап на карточке
 *  ребёнка достаточно прост, чтобы не плодить лишний Stack.Screen. */
export default function ChildWalletScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, loading } = useParentData();
  const [openChildId, setOpenChildId] = useState<string | null>(null);

  const openChild = parentCtx?.children.find((c) => c.id === openChildId) ?? null;

  if (openChild) {
    return (
      <ChildWalletDetail
        childId={openChild.id}
        childName={openChild.fullName}
        onBack={() => setOpenChildId(null)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.walletTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {loading ? (
            <ScreenSkeleton />
          ) : !parentCtx || parentCtx.children.length === 0 ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : (
            <View style={{ gap: 10 }}>
              {parentCtx.children.map((c) => (
                <ChildWalletRow key={c.id} childId={c.id} name={c.fullName} className={c.className} locale={locale} onPress={() => setOpenChildId(c.id)} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ChildWalletRow({ childId, name, className, locale, onPress }: {
  childId: string; name: string; className: string | null; locale: string; onPress: () => void;
}) {
  const { d } = useAppLocale();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadWallet(childId, name).then((w) => { if (alive) setBalance(w.balance); });
    return () => { alive = false; };
  }, [childId, name]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: colors.card, borderRadius: radii.xl, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1, ...shadow.soft,
      }]}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{name}</Text>
        <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{className ?? d.common.none}</Text>
      </View>
      {balance == null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textPrimary }}>{balance.toLocaleString(locale)}</Text>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

function ChildWalletDetail({ childId, childName, onBack }: { childId: string; childName: string; onBack: () => void }) {
  const { d, locale } = useAppLocale();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  function refresh() {
    loadWallet(childId, childName).then(setWallet);
  }
  useEffect(refresh, [childId, childName]);

  function onTopUp() {
    setTopUpSuccess(true);
  }

  if (topUpSuccess) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: "800", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>{d.parentMobile.walletTopUpSuccessTitle}</Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: "center", marginBottom: 28 }}>{d.parentMobile.walletTopUpSuccessDesc}</Text>
            <Pressable
              onPress={() => setTopUpSuccess(false)}
              style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 13, paddingHorizontal: 32 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{d.parentMobile.checkoutBackBtn}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable
              onPress={onBack}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 16.5, fontWeight: "800", color: colors.textPrimary }}>{childName}</Text>
            <View style={{ width: 38 }} />
          </View>

          {!wallet ? (
            <ScreenSkeleton />
          ) : (
            <>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, padding: 18, alignItems: "center", marginBottom: spacing.md, ...shadow.card }}>
                <Text style={{ fontSize: 11.5, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>{d.parentMobile.walletBalanceLabel}</Text>
                <Text style={{ fontSize: 26, fontWeight: "800", color: colors.textPrimary }}>
                  {`${wallet.balance.toLocaleString(locale)} ${d.parentMobile.sumCurrency}`}
                </Text>
              </View>

              <Pressable
                onPress={onTopUp}
                style={({ pressed }) => [{
                  backgroundColor: colors.primary, borderRadius: radii.xl, paddingVertical: 14, alignItems: "center",
                  marginBottom: spacing.lg, opacity: pressed ? 0.9 : 1,
                }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{d.parentMobile.walletTopUpBtn}</Text>
              </Pressable>

              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 }}>{d.parentMobile.walletRecentTitle}</Text>
              {wallet.purchases.length === 0 ? (
                <EmptyState icon="cart-outline" title={d.parentMobile.walletEmpty} description={d.parentMobile.comingSoonSection} />
              ) : (
                <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, ...shadow.soft }}>
                  {wallet.purchases.map((p, i) => (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12,
                        borderBottomWidth: i < wallet.purchases.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.warningBg, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="restaurant-outline" size={16} color={colors.warning} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary }}>{p.title}</Text>
                        <Text style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 2 }}>{formatDate(p.date, locale)}</Text>
                      </View>
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textSecondary }}>{p.amount.toLocaleString(locale)}</Text>
                    </View>
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
