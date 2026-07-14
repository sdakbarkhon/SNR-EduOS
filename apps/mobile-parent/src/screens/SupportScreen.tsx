// TODO(support-backend): no real support-chat backend exists yet - this whole screen is a
// scripted mock demo conversation with no live data or real message sending. Replace with a
// real support-ticket/chat system when one exists.
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAppLocale } from "../i18n";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

type Bubble =
  | { kind: "me"; id: string; text: string; ts: string }
  | { kind: "support"; id: string; text: string; ts: string }
  | { kind: "card"; id: string; title: string; text: string; ts: string };

/** 4 чипа "популярных вопросов" -> пара реплик (моя + ответ поддержки). Ключ
 *  reply* берётся из d.parentMobile, replyStyle различает обычный ответ
 *  поддержки от карточки-успеха (чеки/документы). */
type ChipKey = "tuition" | "meals" | "receipts" | "refund";

export default function SupportScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  // Начальное состояние — захардкоженный сценарий демо-переписки (пункт 5 ТЗ),
  // НЕ данные из БД. Дальше в этот же массив добавляются реплики по нажатию чипов.
  const [messages, setMessages] = useState<Bubble[]>(() => [
    { kind: "me", id: "seed-1", text: d.parentMobile.supportDialogUser1, ts: "10:24" },
    { kind: "support", id: "seed-2", text: d.parentMobile.supportDialogSupport1, ts: "10:25" },
    { kind: "me", id: "seed-3", text: d.parentMobile.supportDialogUser2, ts: "10:31" },
    {
      kind: "card",
      id: "seed-4",
      title: d.parentMobile.supportDialogSupport2Title,
      text: d.parentMobile.supportDialogSupport2Body,
      ts: "10:32",
    },
  ]);
  const [draft, setDraft] = useState("");

  const chips: { key: ChipKey; label: string }[] = [
    { key: "tuition", label: d.parentMobile.supportChipTuition },
    { key: "meals", label: d.parentMobile.supportChipMeals },
    { key: "receipts", label: d.parentMobile.supportChipReceipts },
    { key: "refund", label: d.parentMobile.supportChipRefund },
  ];

  function nowLabel(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function onChipPress(key: ChipKey, label: string) {
    const ts = nowLabel();
    const askId = `chip-${key}-${Date.now()}`;
    const ask: Bubble = { kind: "me", id: askId, text: label, ts };

    let reply: Bubble;
    if (key === "tuition") {
      reply = { kind: "support", id: `${askId}-r`, text: d.parentMobile.supportReplyTuition, ts };
    } else if (key === "meals") {
      reply = { kind: "support", id: `${askId}-r`, text: d.parentMobile.supportReplyMeals, ts };
    } else if (key === "receipts") {
      reply = {
        kind: "card",
        id: `${askId}-r`,
        title: d.parentMobile.supportReplyReceiptsTitle,
        text: d.parentMobile.supportReplyReceiptsBody,
        ts,
      };
    } else {
      reply = { kind: "support", id: `${askId}-r`, text: d.parentMobile.supportReplyRefund, ts };
    }

    setMessages((prev) => [...prev, ask, reply]);
  }

  function onSendPress() {
    // Реальной отправки нет — весь экран мок, см. TODO в начале файла.
    Alert.alert(d.parentMobile.supportSendMockNotice);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => [{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                opacity: pressed ? 0.85 : 1, ...shadow.soft,
              }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 15.5, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 }}>
                {d.parentMobile.supportTitle}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.success, marginTop: 1 }}>
                {"● "}{d.parentMobile.supportOnlineStatus}
              </Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Карточка-приветствие */}
            <View
              style={{
                backgroundColor: "#F1EBFF", borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radii.xl,
                padding: 13, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 13,
              }}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="headset-outline" size={19} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.supportTitle}</Text>
                <Text style={{ fontSize: 10.5, color: colors.textSecondary, marginTop: 1 }}>{d.parentMobile.supportOnlineStatus}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 9, fontWeight: "600", color: colors.textMuted }}>{d.parentMobile.supportAvgResponseLabel}</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{d.parentMobile.supportAvgResponseValue}</Text>
              </View>
            </View>

            {/* Популярные вопросы */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, marginBottom: 7 }}>
              {d.parentMobile.supportPopularQuestionsTitle}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {chips.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => onChipPress(c.key, c.label)}
                  style={({ pressed }) => [{
                    borderWidth: 1.5, borderColor: colors.borderAlt, backgroundColor: "#fff", borderRadius: radii.sm,
                    paddingVertical: 7, paddingHorizontal: 11, opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>{c.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Разделитель-дата */}
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 10.5, fontWeight: "700", color: colors.textSecondary, backgroundColor: colors.chipBg,
                  borderRadius: 9, paddingVertical: 5, paddingHorizontal: 12,
                }}
              >
                {d.chat.today}
              </Text>
            </View>

            {messages.map((m) => (
              <SupportBubble key={m.id} bubble={m} />
            ))}
          </ScrollView>

          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10,
              backgroundColor: colors.bgAlt, borderTopWidth: 1, borderTopColor: colors.border,
            }}
          >
            <View
              style={{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.borderAlt,
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <Ionicons name="attach-outline" size={16} color={colors.textSecondary} />
            </View>
            <View
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1.5,
                borderColor: colors.borderAlt, borderRadius: 20, height: 40, paddingHorizontal: 14,
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={d.chat.composerPlaceholder}
                placeholderTextColor={colors.textFaint}
                style={{ flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.textPrimary, padding: 0 }}
              />
            </View>
            <Pressable
              onPress={onSendPress}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, flexShrink: 0 }]}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SupportBubble({ bubble }: { bubble: Bubble }) {
  if (bubble.kind === "me") {
    return (
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 9 }}>
        <View style={{ maxWidth: "80%", backgroundColor: "#EFEAFF", borderRadius: radii.lg, borderTopRightRadius: 4, padding: 11 }}>
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: "#3A2E75" }}>{bubble.text}</Text>
          <Text style={{ fontSize: 9, fontWeight: "600", color: "#9B8FD6", textAlign: "right", marginTop: 4 }}>{bubble.ts}</Text>
        </View>
      </View>
    );
  }

  if (bubble.kind === "support") {
    return (
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 9 }}>
        <View
          style={{
            width: 28, height: 28, borderRadius: 14, backgroundColor: "#F1EBFF", alignItems: "center", justifyContent: "center",
            flexShrink: 0, marginTop: 2,
          }}
        >
          <Ionicons name="headset-outline" size={13} color={colors.primary} />
        </View>
        <View style={{ maxWidth: "76%", backgroundColor: colors.card, borderRadius: radii.lg, borderTopLeftRadius: 4, padding: 11, ...shadow.soft }}>
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textPrimary }}>{bubble.text}</Text>
          <Text style={{ fontSize: 9, fontWeight: "600", color: colors.textFaint, textAlign: "right", marginTop: 4 }}>{bubble.ts}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 9 }}>
      <View
        style={{
          width: 28, height: 28, borderRadius: 14, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 2,
        }}
      >
        <Ionicons name="checkmark-circle" size={15} color={colors.success} />
      </View>
      <View style={{ maxWidth: "76%", backgroundColor: colors.card, borderWidth: 1.5, borderColor: "#CBF0DD", borderRadius: radii.lg, padding: 11 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: "#128254", marginBottom: 4 }}>{bubble.title}</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{bubble.text}</Text>
        <Text style={{ fontSize: 9, fontWeight: "600", color: colors.textFaint, textAlign: "right", marginTop: 4 }}>{bubble.ts}</Text>
      </View>
    </View>
  );
}
