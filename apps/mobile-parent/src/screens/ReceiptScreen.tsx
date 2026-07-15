import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTime } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { ScreenSkeleton, ErrorState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import { findHistoryRecord, type PaymentHistoryRecord } from "../lib/mockPaymentsData";
import type { MainStackParamList } from "../navigation/MainNavigator";

/** Промт МОБ-5, Экран 5 — Чек об оплате (mock-flat: школьные реквизиты и
 *  "Поделиться"/"Скачать PDF" — заглушка на будущее; плательщик — реальное
 *  ФИО родителя из Supabase auth). */
export default function ReceiptScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "Receipt">>();
  const { recordId } = route.params;
  const { data: parentCtx } = useParentData();
  const child = useSelectedChild();

  const record = useAsyncData<PaymentHistoryRecord | null>(
    () => (child ? findHistoryRecord(child.id, recordId) : Promise.resolve(null)),
    [child?.id, recordId],
  );

  function onShare() {
    Alert.alert(d.parentMobile.receiptShareMockNotice);
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
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.receiptTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          {record.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={record.refresh} />
          ) : record.loading ? (
            <ScreenSkeleton />
          ) : !record.data ? (
            <ErrorState message={d.parentMobile.hwDetailNotFound} retryLabel={d.common.back} onRetry={() => nav.goBack()} />
          ) : (
            <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, padding: 20, ...shadow.card }}>
              <View style={{ alignItems: "center", marginBottom: 18 }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Ionicons name="school-outline" size={26} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.receiptSchoolName}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{d.parentMobile.receiptSchoolDetails}</Text>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 12 }}>
                <ReceiptRow label={d.parentMobile.receiptPayerLabel} value={parentCtx?.parentName ?? d.common.none} />
                <ReceiptRow label={d.parentMobile.receiptItemLabel} value={record.data.title} />
                <ReceiptRow label={d.parentMobile.receiptDateLabel} value={formatDateTime(record.data.paidAt, locale)} />
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{d.parentMobile.receiptTotalLabel}</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.primary }}>
                  {`${record.data.amount.toLocaleString(locale)} ${d.parentMobile.sumCurrency}`}
                </Text>
              </View>
            </View>
          )}

          {record.data && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
              <Pressable
                onPress={onShare}
                style={({ pressed }) => [{
                  flex: 1, backgroundColor: colors.card, borderRadius: radii.xl, paddingVertical: 13,
                  alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                }]}
              >
                <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>{d.parentMobile.receiptShareBtn}</Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                style={({ pressed }) => [{
                  flex: 1, backgroundColor: colors.primary, borderRadius: radii.xl, paddingVertical: 13,
                  alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, opacity: pressed ? 0.85 : 1,
                }]}
              >
                <Ionicons name="download-outline" size={17} color="#fff" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{d.common.download}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, textAlign: "right", flexShrink: 1 }}>{value}</Text>
    </View>
  );
}
