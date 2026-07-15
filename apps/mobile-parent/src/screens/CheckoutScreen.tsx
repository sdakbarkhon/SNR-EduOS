import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDate, format } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useSelectedChild } from "../context/ParentDataContext";
import { colors, radii, shadow, spacing } from "../theme";
import { payBill } from "../lib/mockPaymentsData";
import { loadPaymentCards, type PaymentCard } from "../lib/mockProfileData";
import type { MainStackParamList } from "../navigation/MainNavigator";

type Stage = "form" | "processing" | "success";

/** Промт МОБ-5, Экран 3 — Checkout. Полностью mock-interactive: сценарий
 *  ошибки НЕ реализован (по ТЗ — только happy path для демо). */
export default function CheckoutScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "Checkout">>();
  const { bill } = route.params;
  const child = useSelectedChild();

  const [cards, setCards] = useState<PaymentCard[] | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("form");

  useEffect(() => {
    loadPaymentCards().then((list) => {
      setCards(list);
      setSelectedCardId(list.find((c) => c.isPrimary)?.id ?? list[0]?.id ?? null);
    });
  }, []);

  async function onPay() {
    if (!child || stage !== "form") return;
    setStage("processing");
    await payBill(child.id, child.className ?? "", bill);
    setTimeout(() => setStage("success"), 1500);
  }

  if (stage === "success") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: "800", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>
              {d.parentMobile.checkoutSuccessTitle}
            </Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: "center", marginBottom: 28 }}>
              {format(d.parentMobile.checkoutSuccessDesc, { title: bill.title })}
            </Text>
            <Pressable
              onPress={() => nav.popToTop()}
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
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable
              onPress={() => nav.goBack()}
              disabled={stage === "processing"}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.checkoutTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 16, marginBottom: spacing.lg, ...shadow.soft }}>
            <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 6 }}>{bill.title}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
              {format(d.parentMobile.billsDueLabel, { date: formatDate(bill.dueDate, locale) })}
            </Text>
            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.primary }}>
              {`${bill.amount.toLocaleString(locale)} ${d.parentMobile.sumCurrency}`}
            </Text>
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            {d.parentMobile.checkoutMethodLabel}
          </Text>

          {!cards ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : cards.length === 0 ? (
            <Pressable
              onPress={() => nav.navigate("PaymentMethods")}
              style={({ pressed }) => [{
                backgroundColor: colors.card, borderRadius: radii.xl, padding: 16, alignItems: "center",
                marginBottom: spacing.lg, opacity: pressed ? 0.85 : 1, ...shadow.soft,
              }]}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>{d.parentMobile.checkoutNoCards}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="add-circle" size={18} color={colors.primary} />
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.checkoutAddCardBtn}</Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ gap: 8, marginBottom: spacing.lg }}>
              {cards.map((card) => {
                const selected = card.id === selectedCardId;
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => setSelectedCardId(card.id)}
                    style={({ pressed }) => [{
                      backgroundColor: colors.card, borderRadius: radii.xl, padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
                      borderWidth: 1.5, borderColor: selected ? colors.primary : "transparent", opacity: pressed ? 0.9 : 1, ...shadow.soft,
                    }]}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="card-outline" size={18} color={colors.primary} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>
                      {`${card.brand} •••• ${card.last4}`}
                    </Text>
                    <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primary : colors.textFaint} />
                  </Pressable>
                );
              })}
              <Pressable onPress={() => nav.navigate("PaymentMethods")} style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{d.parentMobile.checkoutAddCardBtn}</Text>
              </Pressable>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={onPay}
            disabled={stage === "processing" || !selectedCardId}
            style={({ pressed }) => [{
              backgroundColor: colors.primary, borderRadius: radii.xl, paddingVertical: 15, alignItems: "center",
              opacity: stage === "processing" || !selectedCardId ? 0.6 : pressed ? 0.9 : 1, flexDirection: "row", justifyContent: "center", gap: 8,
            }]}
          >
            {stage === "processing" ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>{d.parentMobile.checkoutProcessing}</Text>
              </>
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>
                {format(d.parentMobile.checkoutPayBtn, { amount: `${bill.amount.toLocaleString(locale)} ${d.parentMobile.sumCurrency}` })}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
