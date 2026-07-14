import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getChildGradesSummary, type ChildGradesSummary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";

export default function ProgressScreen() {
  const { d } = useAppLocale();
  const child = useSelectedChild();

  const summary = useAsyncData<ChildGradesSummary | null>(
    () => (child ? getChildGradesSummary(getSupabase(), child.id) : Promise.resolve(null)),
    [child?.id],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={summary.refreshing} onRefresh={summary.refresh} tintColor={colors.primary} />}
        >
          <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, marginBottom: 14 }}>{d.parentMobile.tabProgress}</Text>

          {!child ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : summary.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={summary.refresh} />
          ) : summary.loading ? (
            <ScreenSkeleton />
          ) : !summary.data || summary.data.subjects.length === 0 ? (
            <EmptyState icon="trophy-outline" title={d.parentMobile.gradesEmpty} description={d.parentMobile.comingSoonSection} />
          ) : (
            <>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 4 }}>{d.parentUi.overallAverage}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <Text style={{ fontSize: 44, fontWeight: "800", color: colors.textPrimary, letterSpacing: -1.5 }}>
                  {summary.data.average?.toFixed(1) ?? "—"}
                </Text>
              </View>

              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                {d.parentUi.subjectAverage}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 14, ...shadow.soft }}>
                {summary.data.subjects.map((s, i) => (
                  <View
                    key={s.subjectId}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11,
                      borderBottomWidth: i < summary.data!.subjects.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ width: 37, height: 37, borderRadius: 12, backgroundColor: (s.color ?? colors.primary) + "22", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="book-outline" size={18} color={s.color ?? colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 }}>{s.subjectName}</Text>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
                        <View style={{ height: "100%", width: `${Math.min(100, (s.average / 5) * 100)}%`, borderRadius: 3, backgroundColor: colors.primary }} />
                      </View>
                    </View>
                    <Text style={{ width: 32, textAlign: "right", fontSize: 14.5, fontWeight: "800", color: colors.textPrimary }}>
                      {s.average.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>

              {summary.data.strengths.length > 0 && (
                <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, ...shadow.soft }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, marginBottom: 9 }}>{d.parentMobile.strengthsTitle}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: summary.data.growthAreas.length > 0 ? 14 : 0 }}>
                    {summary.data.strengths.map((s) => (
                      <Text key={s} style={{ fontSize: 12, fontWeight: "600", color: colors.success, backgroundColor: colors.successBg, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 11 }}>
                        {s}
                      </Text>
                    ))}
                  </View>
                  {summary.data.growthAreas.length > 0 && (
                    <>
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, marginBottom: 9 }}>{d.parentMobile.growthAreasTitle}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                        {summary.data.growthAreas.map((s) => (
                          <Text key={s} style={{ fontSize: 12, fontWeight: "600", color: colors.danger, backgroundColor: colors.dangerBg, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 11 }}>
                            {s}
                          </Text>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
