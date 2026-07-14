import { useMemo } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getChildGradesSummary,
  getChildWeekActivity,
  getStudentAttendance,
  getChildTeacherReviews,
  format,
  type ChildGradesSummary,
  type ChildWeekActivity,
  type ChildTeacherReview,
} from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import { getMockSkillsPreview } from "../lib/mockSkills";
import type { MainStackParamList } from "../navigation/MainNavigator";

type AttendanceStats = { total: number; present: number; excused: number; unexcused: number; percentage: number };

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function ProgressScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, selectChild } = useParentData();
  const child = useSelectedChild();

  const summary = useAsyncData<ChildGradesSummary | null>(
    () => (child ? getChildGradesSummary(getSupabase(), child.id) : Promise.resolve(null)),
    [child?.id],
  );
  const week = useAsyncData<ChildWeekActivity | null>(
    () => (child ? getChildWeekActivity(getSupabase(), child.id) : Promise.resolve(null)),
    [child?.id],
  );
  const attendance = useAsyncData<{ stats: AttendanceStats } | null>(
    () => (child ? getStudentAttendance(getSupabase(), undefined, child.id) : Promise.resolve(null)),
    [child?.id],
  );
  const reviews = useAsyncData<ChildTeacherReview[]>(
    () =>
      child
        ? getChildTeacherReviews(getSupabase(), child.id, { sinceDays: 14, limit: 3 })
        : Promise.resolve([]),
    [child?.id],
  );

  const skills = useMemo(() => (child ? getMockSkillsPreview(child.id, 4) : []), [child?.id]);

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

  function refreshAll() {
    summary.refresh();
    week.refresh();
    attendance.refresh();
    reviews.refresh();
  }

  const loading = child != null && (summary.loading || week.loading || attendance.loading || reviews.loading);
  const refreshing = summary.refreshing || week.refreshing || attendance.refreshing || reviews.refreshing;
  const error = summary.error ?? week.error ?? attendance.error ?? reviews.error;

  const avg = summary.data?.average ?? null;
  const ratingLabel =
    avg == null
      ? null
      : avg >= 4.5
        ? d.parentMobile.progRatingExcellent
        : avg >= 3.5
          ? d.parentMobile.progRatingGood
          : avg >= 2.5
            ? d.parentMobile.progRatingAverage
            : d.parentMobile.progRatingLow;

  const deltaPct = week.data?.deltaPct ?? null;
  const weekCaption =
    deltaPct == null ? null : deltaPct > 0 ? d.parentMobile.progWeekUp : deltaPct < 0 ? d.parentMobile.progWeekDown : d.parentMobile.progWeekFlat;

  const stats = attendance.data?.stats ?? null;
  const subjects = summary.data?.subjects ?? [];
  const reviewsList = reviews.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
        >
          {/* Заголовок */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.4 }}>
              {d.parentMobile.tabProgress}
            </Text>
            <Pressable
              onPress={() => nav.navigate("Notifications")}
              style={({ pressed }) => [{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff",
                alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...shadow.soft,
              }]}
            >
              <Ionicons name="notifications-outline" size={19} color={colors.textPrimary} />
            </Pressable>
          </View>

          {!child ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={refreshAll} />
          ) : loading ? (
            <ScreenSkeleton />
          ) : (
            <>
              {/* Карточка ребёнка */}
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
                {parentCtx && parentCtx.children.length > 1 && (
                  <Pressable
                    onPress={onSwitchChild}
                    style={({ pressed }) => [{
                      backgroundColor: colors.chipBg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11,
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, textAlign: "center" }}>
                      {d.parentMobile.switchChildBtn}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Hero: 3 метрики */}
              <LinearGradient
                colors={gradients.warmCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: radii.xxl, padding: 16, marginBottom: spacing.lg }}
              >
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1.1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                      {d.parentMobile.progAverageLabel}
                    </Text>
                    <Text style={{ fontSize: 27, fontWeight: "800", color: "#fff", letterSpacing: -0.5 }}>
                      {avg != null ? avg.toFixed(1) : "—"}
                      <Text style={{ fontSize: 13, fontWeight: "600", opacity: 0.75 }}>/5.0</Text>
                    </Text>
                    {ratingLabel && (
                      <Text style={{ fontSize: 10, fontWeight: "600", color: "#fff", opacity: 0.85, marginTop: 5 }}>{ratingLabel}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.25)" }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                      {d.parentMobile.progWeekLabel}
                    </Text>
                    <Text style={{ fontSize: 27, fontWeight: "800", color: "#fff", letterSpacing: -0.5 }}>
                      {deltaPct != null ? `${deltaPct >= 0 ? "↑" : "↓"}${Math.abs(deltaPct)}%` : "—"}
                    </Text>
                    {weekCaption && (
                      <Text style={{ fontSize: 10, fontWeight: "600", color: "#fff", opacity: 0.85, marginTop: 5 }}>{weekCaption}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.25)" }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                      {d.parentMobile.progAttendanceLabel}
                    </Text>
                    <Text style={{ fontSize: 27, fontWeight: "800", color: "#fff", letterSpacing: -0.5 }}>
                      {stats ? `${stats.percentage}%` : "—"}
                    </Text>
                    {stats && (
                      <Text style={{ fontSize: 10, fontWeight: "600", color: "#fff", opacity: 0.85, marginTop: 5 }}>
                        {format(d.parentMobile.progAttendedOfTotal, { a: stats.present, b: stats.total })}
                      </Text>
                    )}
                  </View>
                </View>
              </LinearGradient>

              {/* Навыки и прогресс */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 }}>
                  {d.parentMobile.progSkillsSectionTitle}
                </Text>
                <Pressable onPress={() => nav.navigate("Skills", { childId: child.id })}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{d.parentMobile.progSeeMore}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.lg }}>
                {skills.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => nav.navigate("Skills", { childId: child.id })}
                    style={({ pressed }) => [{
                      width: "22.5%", backgroundColor: colors.card, borderRadius: 15, paddingVertical: 11, paddingHorizontal: 3,
                      alignItems: "center", gap: 6, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                    }]}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={s.icon} size={17} color={s.color} />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 9.5, fontWeight: "600", color: colors.textSecondary }}>
                      {d.parentMobile[s.nameKey]}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textPrimary, lineHeight: 16 }}>{s.value}%</Text>
                    <View style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${s.value}%`, borderRadius: 2, backgroundColor: s.color }} />
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Предметы */}
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2, marginBottom: 10 }}>
                {d.parentMobile.progSubjectsSectionTitle}
              </Text>
              {subjects.length === 0 ? (
                <View style={{ marginBottom: spacing.lg }}>
                  <EmptyState icon="trophy-outline" title={d.parentMobile.progSubjectsEmpty} description={d.parentMobile.comingSoonSection} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: spacing.lg }}>
                  {subjects.map((s) => (
                    <Pressable
                      key={s.subjectId}
                      onPress={() => nav.navigate("SubjectDetail", { subjectId: s.subjectId, childId: child.id })}
                      style={({ pressed }) => [{
                        width: "47%", backgroundColor: colors.card, borderRadius: radii.lg, padding: 13,
                        opacity: pressed ? 0.85 : 1, ...shadow.soft,
                      }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                        <View
                          style={{
                            width: 38, height: 38, borderRadius: 12, backgroundColor: (s.color ?? colors.primary) + "22",
                            alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Ionicons name="book-outline" size={18} color={s.color ?? colors.primary} />
                        </View>
                        <Text style={{ fontSize: 19, fontWeight: "800", color: colors.textPrimary }}>
                          {s.average.toFixed(1)}
                          <Text style={{ fontSize: 11, color: colors.star }}> ★</Text>
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, marginBottom: 7 }}>
                        {s.subjectName}
                      </Text>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
                        <View
                          style={{
                            height: "100%", width: `${Math.min(100, (s.average / 5) * 100)}%`,
                            borderRadius: 3, backgroundColor: s.color ?? colors.primary,
                          }}
                        />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Последние отзывы учителей */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 }}>
                  {d.parentMobile.progReviewsSectionTitle}
                </Text>
                <Pressable onPress={() => nav.navigate("TeacherReviews", { childId: child.id })}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{d.parentMobile.progReviewsSeeAll}</Text>
                </Pressable>
              </View>
              {reviewsList.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: spacing.lg }}>
                  {d.parentMobile.progReviewsEmpty}
                </Text>
              ) : (
                <View style={{ marginBottom: spacing.lg }}>
                  {reviewsList.map((r) => (
                    <View
                      key={r.id}
                      style={{
                        backgroundColor: colors.card, borderRadius: radii.lg, paddingVertical: 13, paddingHorizontal: 14,
                        flexDirection: "row", gap: 11, marginBottom: 9, ...shadow.soft,
                      }}
                    >
                      <View
                        style={{
                          width: 38, height: 38, borderRadius: 19, backgroundColor: (r.subjectColor ?? colors.primary) + "22",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "800", color: r.subjectColor ?? colors.primary }}>
                          {r.teacherName ? initials(r.teacherName) : "—"}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 }}>
                            {r.teacherName ?? d.common.none}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textFaint }}>
                            {new Date(r.gradedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 3 }}>{r.comment}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* TODO(ai-progress-summary): заменить на реальный AI-анализ, когда появится источник данных */}
              <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radii.xxl, padding: 15 }}>
                <View style={{ flexDirection: "row", gap: 11, alignItems: "flex-start" }}>
                  <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={14} color="#fff" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary, marginBottom: 3 }}>
                      {d.parentMobile.progAiSummaryTitle}
                    </Text>
                    <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textPrimary }}>{d.parentMobile.progAiSummaryMock}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
