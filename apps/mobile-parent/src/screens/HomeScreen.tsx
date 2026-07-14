import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getChildDailyStats, format, type ChildDailyStats } from "@snr/core";
import { useMemo } from "react";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { ParentProfile } from "../lib/auth";
import type { MainStackParamList } from "../navigation/MainNavigator";

function todayStr(): string {
  // Asia/Tashkent (UTC+5) — тот же сдвиг, что и на вебе (getTashkentWeekMonday).
  return new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function HomeScreen({ profile }: { profile: ParentProfile }) {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, loading: parentLoading, error: parentError, refresh: refreshParent, selectChild } = useParentData();
  const child = useSelectedChild();
  const date = todayStr();

  const stats = useAsyncData<ChildDailyStats | null>(
    () => (child ? getChildDailyStats(getSupabase(), child.id, date) : Promise.resolve(null)),
    [child?.id, date],
  );

  const initialsStr = useMemo(() => (child ? initials(child.fullName) : ""), [child]);

  function onSwitchChild() {
    if (!parentCtx || parentCtx.children.length <= 1) return;
    Alert.alert(
      d.parentUi.classesLabel,
      undefined,
      parentCtx.children.map((c) => ({ text: `${c.fullName}${c.className ? ` — ${c.className}` : ""}`, onPress: () => selectChild(c.id) })),
    );
  }

  const loading = parentLoading || (child != null && stats.loading);
  const error = parentError ?? stats.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={parentCtx != null && (parentLoading || stats.refreshing)}
              onRefresh={() => {
                refreshParent();
                stats.refresh();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
            <Text
              style={{ fontSize: 17, fontWeight: "800", color: colors.primary, letterSpacing: -0.2 }}
            >
              SNR EduOS
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                onPress={() => nav.navigate("Notifications")}
                style={{
                  width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff",
                  alignItems: "center", justifyContent: "center", ...shadow.soft,
                }}
              >
                <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => nav.getParent()?.navigate("Profile" as never)}
                style={{
                  width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{initials(profile.fullName)}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.textSecondary }}>{d.parentMobile.greeting.split(",")[0]},</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.textPrimary, marginTop: 1, marginBottom: 3 }}>
            {profile.fullName.split(" ")[0]}
          </Text>
          {child && (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
              {format(d.parentMobile.homeSubtitle, { name: child.fullName.split(" ")[0] })}
            </Text>
          )}

          {error ? (
            <ErrorState
              message={d.parentMobile.errorGeneric}
              retryLabel={d.common.retry}
              onRetry={() => {
                refreshParent();
                stats.refresh();
              }}
            />
          ) : loading ? (
            <ScreenSkeleton />
          ) : !parentCtx || parentCtx.children.length === 0 ? (
            <EmptyState icon="people-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : (
            <>
              {/* Карточка ребёнка */}
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, padding: 15, marginBottom: spacing.md, ...shadow.card }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 52, height: 52, borderRadius: 26, backgroundColor: "#EFEAFF",
                      alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>{initialsStr}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{child?.fullName}</Text>
                    <Pressable
                      onPress={onSwitchChild}
                      disabled={!parentCtx || parentCtx.children.length <= 1}
                      style={{
                        flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4, marginTop: 4,
                        backgroundColor: colors.chipBg, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>
                        {child?.className ?? d.common.none}
                      </Text>
                      {parentCtx.children.length > 1 && <Ionicons name="chevron-down" size={10} color={colors.textMuted} />}
                    </Pressable>
                  </View>
                </View>

                {stats.data && (
                  <View style={{ flexDirection: "row", marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "600", color: colors.textMuted, marginBottom: 3 }}>{d.parentMobile.statArrival}</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary }}>{fmtTime(stats.data.arrivalTime) ?? "—"}</Text>
                    </View>
                    <View style={{ flex: 1, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "600", color: colors.textMuted, marginBottom: 3 }}>{d.parentMobile.statLessons}</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary }}>{stats.data.lessonsTotal}</Text>
                    </View>
                    <View style={{ flex: 1, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "600", color: colors.textMuted, marginBottom: 3 }}>{d.parentMobile.statAttended}</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary }}>{stats.data.lessonsAttended}/{stats.data.lessonsTotal}</Text>
                    </View>
                    <View style={{ flex: 1.2, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "600", color: colors.textMuted, marginBottom: 3 }}>{d.parentMobile.statNextLesson}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "700", color: colors.primary }}>
                        {stats.data.nextLesson?.subjectName ?? "—"}
                      </Text>
                      {stats.data.nextLesson && (
                        <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.primaryLight }}>{fmtTime(stats.data.nextLesson.startsAt)}</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* MOCK: балансы — TODO(payments) заменить на реальные getPayments/getCharges при подключении оплат */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: spacing.md }}>
                <Pressable
                  onPress={() => nav.getParent()?.navigate("Payments" as never)}
                  style={{
                    flex: 1, borderRadius: radii.xl, padding: 13, backgroundColor: colors.accentCoral,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 10.5, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 3 }}>{d.parentMobile.balanceMealTitle}</Text>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{`80 000 ${d.parentMobile.sumCurrency}`}</Text>
                  </View>
                  <Ionicons name="restaurant-outline" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => nav.getParent()?.navigate("Payments" as never)}
                  style={{
                    flex: 1, borderRadius: radii.xl, padding: 13, backgroundColor: colors.primary,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 10.5, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 3 }}>{d.parentMobile.balanceAccountTitle}</Text>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{`120 000 ${d.parentMobile.sumCurrency}`}</Text>
                  </View>
                  <Ionicons name="wallet-outline" size={18} color="#fff" />
                </Pressable>
              </View>

              {/* MOCK: EduOS Insight — TODO(ai-insight) заменить на реальный AI-анализ, когда появится источник данных */}
              <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radii.xxl, padding: 15, marginBottom: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={14} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.insightTitle}</Text>
                  <View style={{ backgroundColor: colors.accentCoral, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
                    <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#fff" }}>{d.parentMobile.insightBadgeNew}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textPrimary, marginBottom: 13 }}>{d.parentMobile.insightMockBody}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1.15, height: 38, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{d.parentMobile.insightBtnProgress}</Text>
                  </View>
                  <Pressable
                    onPress={() => nav.getParent()?.navigate("Messages" as never)}
                    style={{ flex: 1, height: 38, borderRadius: radii.sm, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.chipBg, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{d.parentMobile.insightBtnMessageTeacher}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Быстрые действия */}
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: 11 }}>{d.parentMobile.quickActionsTitle}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                {[
                  { label: d.parentMobile.quickActionSchedule, icon: "calendar-outline" as const, bg: "#EFEAFF", color: colors.primary, onPress: () => nav.navigate("Schedule") },
                  { label: d.parentMobile.quickActionHomework, icon: "document-text-outline" as const, bg: "#FFE9C0", color: colors.warning, onPress: () => nav.navigate("Homework") },
                  { label: d.parentMobile.quickActionGrades, icon: "trophy-outline" as const, bg: colors.successBg, color: colors.success, onPress: () => nav.getParent()?.navigate("Progress" as never) },
                  { label: d.parentUi.attendanceTitle, icon: "checkmark-circle-outline" as const, bg: colors.dangerBg, color: colors.danger, onPress: () => child && nav.navigate("ChildProfile", { childId: child.id }) },
                  { label: d.parentMobile.quickActionPayments, icon: "card-outline" as const, bg: "#FFE9EE", color: colors.accentCoral, onPress: () => nav.getParent()?.navigate("Payments" as never) },
                  { label: d.parentMobile.quickActionMessages, icon: "chatbubbles-outline" as const, bg: "#F1EBFF", color: colors.primaryLight, onPress: () => nav.getParent()?.navigate("Messages" as never) },
                ].map((qa) => (
                  <Pressable
                    key={qa.label}
                    onPress={qa.onPress}
                    style={{
                      width: "31%", backgroundColor: colors.card, borderRadius: radii.lg, paddingVertical: 13,
                      alignItems: "center", gap: 8, ...shadow.soft,
                    }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: qa.bg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={qa.icon} size={20} color={qa.color} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textPrimary, textAlign: "center" }}>{qa.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
