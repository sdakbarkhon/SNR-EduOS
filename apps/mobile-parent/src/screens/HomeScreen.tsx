import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getChildDailyStats, getChildDailyStatus, format, type ChildDailyStats, type ChildDailyStatus } from "@snr/core";
import { useEffect, useMemo, useState } from "react";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { getJSON } from "../lib/mockStorage";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { ParentProfile } from "../lib/auth";
import type { MainStackParamList } from "../navigation/MainNavigator";

type CachedInsight = { summary: string; insights: Array<{ title: string; body: string; sentiment: "positive" | "neutral" | "warning" }> };

// Приоритет "самого важного" инсайта для превью на главном: warning (требует
// внимания) > positive (похвалить) > neutral — тот же принцип "highest
// sentiment", что просил промт.
function pickTopInsight(cached: CachedInsight): CachedInsight["insights"][number] | null {
  const bySentiment = (s: string) => cached.insights.find((i) => i.sentiment === s);
  return bySentiment("warning") ?? bySentiment("positive") ?? cached.insights[0] ?? null;
}

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

type NowStatus = { icon: keyof typeof Ionicons.glyphMap; color: string; text: string };

function computeNowStatus(status: ChildDailyStatus, d: ReturnType<typeof useAppLocale>["d"]): NowStatus {
  if (status.isDayOff) {
    return { icon: "sunny-outline", color: colors.success, text: d.parentMobile.dailyStatusDayOffTitle };
  }
  const now = Date.now();
  for (const lesson of status.lessons) {
    const start = new Date(lesson.startsAt).getTime();
    const end = lesson.endsAt ? new Date(lesson.endsAt).getTime() : start + 45 * 60000;
    if (now >= start && now <= end) {
      return { icon: "school-outline", color: colors.success, text: `${d.parentMobile.dailyStatusOnLesson}: ${lesson.subjectName ?? lesson.title}` };
    }
  }
  const next = status.lessons.find((l) => new Date(l.startsAt).getTime() > now);
  if (next) {
    const minutes = Math.max(0, Math.round((new Date(next.startsAt).getTime() - now) / 60000));
    return { icon: "time-outline", color: colors.textSecondary, text: format(d.parentMobile.dailyStatusBreakLabel, { n: minutes }) };
  }
  return { icon: "checkmark-done-outline", color: colors.textMuted, text: d.parentMobile.dailyStatusHomeWidgetDone };
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

  // Промт МОБ-7 — виджет "Сейчас в школе" (v7 preview): та же getChildDailyStatus,
  // что и полный DailyStatusScreen, просто без построения timeline на клиенте.
  const dailyStatus = useAsyncData<ChildDailyStatus | null>(
    () => (child ? getChildDailyStatus(getSupabase(), child.id, date) : Promise.resolve(null)),
    [child?.id, date],
  );

  // Промт МОБ-7 — виджет "Инсайт недели" (v8 preview): читает ТОЛЬКО локальный
  // secure-store кэш (тот же ключ, что InsightScreen), никакого API-вызова с
  // главного экрана — не хотим тратить Gemini-запрос на каждое открытие таба.
  const [weekInsight, setWeekInsight] = useState<CachedInsight | null>(null);
  useEffect(() => {
    if (!child) { setWeekInsight(null); return; }
    getJSON<CachedInsight>(`mob8.insight.${child.id}`).then(setWeekInsight);
  }, [child?.id]);
  const topInsight = weekInsight ? pickTopInsight(weekInsight) : null;
  const nowStatus = dailyStatus.data ? computeNowStatus(dailyStatus.data, d) : null;

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

              {/* Промт МОБ-7 — превью v7 "Статус дня": та же getChildDailyStatus, что
                  и полный экран, свёрнутая в одну строку с текущим статусом ребёнка. */}
              {nowStatus && (
                <Pressable
                  onPress={() => nav.navigate("DailyStatus")}
                  style={({ pressed }) => [{
                    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card,
                    borderRadius: radii.xl, padding: 13, marginBottom: spacing.md, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: nowStatus.color + "22", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={nowStatus.icon} size={18} color={nowStatus.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginBottom: 2 }}>{d.parentMobile.homeNowAtSchoolTitle}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{nowStatus.text}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              )}

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

              {/* Промт МОБ-7 — превью v8 EduOS Assistant Insight: показывает инсайт
                  с наивысшим приоритетом из локального кэша (тот же ключ, что и
                  InsightScreen), иначе — прежний "coming soon" мок-текст. */}
              <Pressable
                onPress={() => nav.navigate("Insight")}
                style={({ pressed }) => [{
                  backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radii.xxl,
                  padding: 15, marginBottom: spacing.lg, opacity: pressed ? 0.92 : 1,
                }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={14} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.homeInsightWeekTitle}</Text>
                  {!topInsight && (
                    <View style={{ backgroundColor: colors.accentCoral, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#fff" }}>{d.parentMobile.insightBadgeNew}</Text>
                    </View>
                  )}
                </View>
                {topInsight ? (
                  <>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 3 }}>{topInsight.title}</Text>
                    <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginBottom: 13 }}>{topInsight.body}</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textPrimary, marginBottom: 13 }}>{d.parentMobile.insightMockBody}</Text>
                )}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => nav.navigate("Insight")}
                    style={{ flex: 1.15, height: 38, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{d.parentMobile.insightBtnProgress}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => nav.getParent()?.navigate("Messages" as never)}
                    style={{ flex: 1, height: 38, borderRadius: radii.sm, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.chipBg, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{d.parentMobile.insightBtnMessageTeacher}</Text>
                  </Pressable>
                </View>
              </Pressable>

              {/* Быстрые действия */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.quickActionsTitle}</Text>
                <Pressable onPress={() => nav.navigate("AllServices")} hitSlop={8}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.homeSeeAllServices}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                {[
                  { label: d.parentMobile.quickActionSchedule, icon: "calendar-outline" as const, bg: "#EFEAFF", color: colors.primary, onPress: () => nav.navigate("Schedule") },
                  { label: d.parentMobile.quickActionHomework, icon: "document-text-outline" as const, bg: "#FFE9C0", color: colors.warning, onPress: () => nav.navigate("Homework") },
                  { label: d.parentMobile.quickActionGrades, icon: "trophy-outline" as const, bg: colors.successBg, color: colors.success, onPress: () => nav.getParent()?.navigate("Progress" as never) },
                  { label: d.parentUi.attendanceTitle, icon: "checkmark-circle-outline" as const, bg: colors.dangerBg, color: colors.danger, onPress: () => child && nav.navigate("AttendanceDetail", { childId: child.id }) },
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
