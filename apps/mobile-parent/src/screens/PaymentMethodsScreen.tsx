import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAppLocale } from "../i18n";
import { colors, radii, shadow, spacing } from "../theme";
import { genId } from "../lib/mockPaymentsData";
import { loadPaymentCards, savePaymentCards, type PaymentCard } from "../lib/mockProfileData";
import type { MainStackParamList } from "../navigation/MainNavigator";

type ScreenView = { mode: "list" } | { mode: "detail"; card: PaymentCard } | { mode: "add" };

/** Промт МОБ-6, Экран 5 — Способы оплаты. Удаление/добавление/смена
 *  основной карты реально пишутся в mockStorage (не только в UI-стейте). */
export default function PaymentMethodsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [cards, setCards] = useState<PaymentCard[] | null>(null);
  const [view, setView] = useState<ScreenView>({ mode: "list" });

  useEffect(() => {
    loadPaymentCards().then(setCards);
  }, []);

  async function persist(next: PaymentCard[]) {
    setCards(next);
    await savePaymentCards(next);
  }

  function onMakePrimary(card: PaymentCard) {
    if (!cards) return;
    persist(cards.map((c) => ({ ...c, isPrimary: c.id === card.id })));
  }

  function onDelete(card: PaymentCard) {
    if (!cards) return;
    Alert.alert(d.parentMobile.pmDeleteConfirmTitle, undefined, [
      { text: d.common.cancel, style: "cancel" },
      {
        text: d.parentMobile.pmDeleteConfirmBtn,
        style: "destructive",
        onPress: () => {
          persist(cards.filter((c) => c.id !== card.id));
          setView({ mode: "list" });
        },
      },
    ]);
  }

  function onAdd(card: PaymentCard) {
    if (!cards) return;
    persist([...cards, card]);
    setView({ mode: "list" });
  }

  if (view.mode === "add") {
    return <AddCardForm onCancel={() => setView({ mode: "list" })} onSave={onAdd} />;
  }

  if (view.mode === "detail") {
    const card = view.card;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Pressable onPress={() => setView({ mode: "list" })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </Pressable>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 16.5, fontWeight: "800", color: colors.textPrimary }}>{`${card.brand} •••• ${card.last4}`}</Text>
              <View style={{ width: 38 }} />
            </View>

            <View style={{ backgroundColor: colors.primary, borderRadius: radii.xxl, padding: 20, marginBottom: spacing.lg }}>
              <Ionicons name="card" size={26} color="#fff" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: 2 }}>{`•••• •••• •••• ${card.last4}`}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff", opacity: 0.85 }}>{card.brand}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff", opacity: 0.85 }}>{card.expiry}</Text>
              </View>
            </View>

            {card.isPrimary ? (
              <View style={{ backgroundColor: colors.successBg, borderRadius: radii.md, paddingVertical: 10, alignItems: "center", marginBottom: spacing.md }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.success }}>{d.parentMobile.pmPrimaryTag}</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => onMakePrimary(card)}
                style={({ pressed }) => [{ backgroundColor: colors.card, borderRadius: radii.xl, paddingVertical: 13, alignItems: "center", marginBottom: spacing.md, opacity: pressed ? 0.85 : 1, ...shadow.soft }]}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.pmMakePrimaryBtn}</Text>
              </Pressable>
            )}

            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              {d.parentMobile.pmDetailUsageTitle}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 20, alignItems: "center", marginBottom: spacing.lg, ...shadow.soft }}>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{d.parentMobile.pmDetailUsageEmpty}</Text>
            </View>

            <Pressable
              onPress={() => onDelete(card)}
              style={({ pressed }) => [{ backgroundColor: colors.dangerBg, borderRadius: radii.xl, paddingVertical: 13, alignItems: "center", opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.danger }}>{d.parentMobile.pmDeleteBtn}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
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
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.pmTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {!cards ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={{ gap: 10, marginBottom: spacing.lg }}>
              {cards.map((card) => (
                <Pressable
                  key={card.id}
                  onPress={() => setView({ mode: "detail", card })}
                  style={({ pressed }) => [{
                    backgroundColor: colors.card, borderRadius: radii.xl, padding: 14,
                    flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="card-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{`${card.brand} •••• ${card.last4}`}</Text>
                    {card.isPrimary && <Text style={{ fontSize: 11, fontWeight: "700", color: colors.success, marginTop: 3 }}>{d.parentMobile.pmPrimaryTag}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => setView({ mode: "add" })}
            style={({ pressed }) => [{
              backgroundColor: colors.card, borderRadius: radii.xl, paddingVertical: 14, alignItems: "center",
              flexDirection: "row", justifyContent: "center", gap: 7, opacity: pressed ? 0.85 : 1, ...shadow.soft,
            }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.pmAddBtn}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AddCardForm({ onCancel, onSave }: { onCancel: () => void; onSave: (card: PaymentCard) => void }) {
  const { d } = useAppLocale();
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  function onSubmit() {
    const digits = number.replace(/\s/g, "");
    const validNumber = digits.length === 16 && /^\d+$/.test(digits);
    const validExpiry = /^\d{2}\/\d{2}$/.test(expiry);
    const validCvv = /^\d{3}$/.test(cvv);
    if (!validNumber || !validExpiry || !validCvv) {
      Alert.alert(d.parentMobile.pmInvalidNotice);
      return;
    }
    onSave({ id: genId("card"), brand: "Uzcard", last4: digits.slice(-4), isPrimary: false, expiry });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable onPress={onCancel} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.pmAddTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ gap: 14 }}>
            <Field label={d.parentMobile.pmCardNumberLabel} value={number} onChangeText={setNumber} placeholder="0000 0000 0000 0000" keyboardType="number-pad" maxLength={19} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={d.parentMobile.pmExpiryLabel} value={expiry} onChangeText={setExpiry} placeholder="MM/YY" keyboardType="number-pad" maxLength={5} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={d.parentMobile.pmCvvLabel} value={cvv} onChangeText={setCvv} placeholder="123" keyboardType="number-pad" maxLength={3} secureTextEntry />
              </View>
            </View>
          </View>

          <Pressable
            onPress={onSubmit}
            style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: radii.xl, paddingVertical: 14, alignItems: "center", marginTop: spacing.xl, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{d.common.save}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, maxLength, secureTextEntry }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: "number-pad"; maxLength?: number; secureTextEntry?: boolean;
}) {
  return (
    <View>
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.textMuted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        style={{ backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontWeight: "600", color: colors.textPrimary, ...shadow.soft }}
      />
    </View>
  );
}
