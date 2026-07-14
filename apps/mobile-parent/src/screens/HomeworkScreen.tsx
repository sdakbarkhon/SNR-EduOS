import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getHomeworkWithSubmissions, type HomeworkWithSubmission } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";

type Filter = "all" | "active" | "done";

function isDone(hw: HomeworkWithSubmission): boolean {
  return hw.submission?.status === "graded" || hw.test_submission?.grade != null;
}

function isOverdue(hw: HomeworkWithSubmission): boolean {
  if (isDone(hw) || hw.submission || hw.test_submission) return false;
  return !!hw.due_date && new Date(hw.due_date).getTime() < Date.now();
}

export default function HomeworkScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation();
  const child = useSelectedChild();
  const [filter, setFilter] = useState<Filter>("all");

  const hw = useAsyncData<HomeworkWithSubmission[]>(
    () => (child ? getHomeworkWithSubmissions(getSupabase(), child.id) : Promise.resolve([])),
    [child?.id],
  );

  const list = hw.data ?? [];
  const total = list.length;
  const done = list.filter(isDone).length;
  const left = total - done;

  const filtered = useMemo(() => {
    if (filter === "active") return list.filter((h) => !isDone(h));
    if (filter === "done") return list.filter(isDone);
    return list;
  }, [list, filter]);

  const recentlyChecked = useMemo(
    () =>
      list
        .filter(isDone)
        .sort((a, b) => (b.submission?.submitted_at ?? "").localeCompare(a.submission?.submitted_at ?? ""))
        .slice(0, 3),
    [list],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={hw.refreshing} onRefresh={hw.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 19, fontWeight: "800", color: colors.textPrimary }}>{d.parentUi.homeworkTitle}</Text>
          </View>

          {!child ? (
            <EmptyState icon="document-text-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : hw.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={hw.refresh} />
          ) : hw.loading ? (
            <ScreenSkeleton />
          ) : (
            <>
              <View style={{ flexDirection: "row", backgroundColor: colors.chipBg, borderRadius: radii.sm, padding: 3, marginBottom: 14 }}>
                {([
                  ["all", d.parentMobile.hwTabAll],
                  ["active", d.parentMobile.hwTabActive],
                  ["done", d.parentMobile.hwTabDone],
                ] as const).map(([key, label]) => (
                  <Pressable
                    key={key}
                    onPress={() => setFilter(key)}
                    style={{
                      flex: 1, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center",
                      backgroundColor: filter === key ? "#fff" : "transparent",
                      ...(filter === key ? shadow.soft : {}),
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: filter === key ? colors.primary : colors.textSecondary }}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 9, marginBottom: 18 }}>
                <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.md, padding: 11, ...shadow.soft }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginBottom: 4 }}>{d.parentMobile.hwStatsTotal}</Text>
                  <Text style={{ fontSize: 21, fontWeight: "800", color: colors.textPrimary }}>{total}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.successBg, borderRadius: radii.md, padding: 11 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.success, marginBottom: 4 }}>{d.parentMobile.hwStatsDone}</Text>
                  <Text style={{ fontSize: 21, fontWeight: "800", color: colors.success }}>{done}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: 11 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.danger, marginBottom: 4 }}>{d.parentMobile.hwStatsLeft}</Text>
                  <Text style={{ fontSize: 21, fontWeight: "800", color: colors.danger }}>{left}</Text>
                </View>
              </View>

              {filtered.length === 0 ? (
                <EmptyState icon="checkmark-done-outline" title={d.parentUi.allHomeworkDone} description={d.parentMobile.comingSoonSection} />
              ) : (
                <>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 }}>{d.parentMobile.hwActiveTitle}</Text>
                  {filtered.map((h) => {
                    const overdue = isOverdue(h);
                    const done_ = isDone(h);
                    const statusLabel = done_ ? d.parentUi.hwStatusDone : overdue ? d.parentUi.hwStatusOverdue : d.parentUi.hwStatusPending;
                    const statusColor = done_ ? colors.success : overdue ? colors.danger : colors.warning;
                    const statusBg = done_ ? colors.successBg : overdue ? colors.dangerBg : colors.warningBg;
                    return (
                      <View
                        key={h.id}
                        style={{
                          backgroundColor: colors.card, borderRadius: radii.lg, padding: 13,
                          flexDirection: "row", gap: 11, alignItems: "center", marginBottom: 9, ...shadow.soft,
                        }}
                      >
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: (h.subjectColor ?? colors.primary) + "22", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="document-text-outline" size={18} color={h.subjectColor ?? colors.primary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{h.subjectName ?? h.group.subject}</Text>
                          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{h.title}</Text>
                          {h.due_date && (
                            <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginTop: 4 }}>
                              {d.parentUi.dueDate} {new Date(h.due_date).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 10.5, fontWeight: "700", color: statusColor, backgroundColor: statusBg, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 }}>
                          {statusLabel}
                        </Text>
                      </View>
                    );
                  })}
                </>
              )}

              {recentlyChecked.length > 0 && (
                <>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginTop: 6, marginBottom: 10 }}>{d.parentMobile.hwRecentlyChecked}</Text>
                  {recentlyChecked.map((h) => (
                    <View
                      key={h.id}
                      style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, flexDirection: "row", gap: 11, alignItems: "center", marginBottom: 9, ...shadow.soft }}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: (h.subjectColor ?? colors.primary) + "22", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="document-text-outline" size={18} color={h.subjectColor ?? colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{h.subjectName ?? h.group.subject}</Text>
                        <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{h.title}</Text>
                      </View>
                      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 17, fontWeight: "800", color: colors.primary }}>{h.submission?.grade ?? h.test_submission?.grade ?? "—"}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
