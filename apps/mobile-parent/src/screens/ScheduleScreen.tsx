import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getStudentLessonsForDate, getStudentLessonsForWeek, type LessonWithSubject } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";

type Mode = "today" | "week";

function tashkentToday(): string {
  return new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function fmtDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function LessonRow({ lesson }: { lesson: LessonWithSubject }) {
  const color = lesson.subject?.color ?? colors.primary;
  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 9 }}>
      <View style={{ width: 42, paddingTop: 13, alignItems: "flex-end" }}>
        <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.textSecondary }}>{fmtTime(lesson.starts_at)}</Text>
      </View>
      <View style={{ alignItems: "center", paddingTop: 17 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, ...shadow.soft }}>
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{lesson.subject?.name ?? lesson.title ?? "—"}</Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
          {lesson.room ? `${lesson.room} · ` : ""}
          {lesson.group.teacher?.full_name ?? ""}
        </Text>
      </View>
    </View>
  );
}

export default function ScheduleScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation();
  const child = useSelectedChild();
  const [mode, setMode] = useState<Mode>("today");
  const today = tashkentToday();
  const weekStart = mondayOf(today);

  const dayData = useAsyncData<LessonWithSubject[]>(
    () => (child ? getStudentLessonsForDate(getSupabase(), today, child.id) : Promise.resolve([])),
    [child?.id, today, mode],
  );
  const weekData = useAsyncData<LessonWithSubject[]>(
    () => (child && mode === "week" ? getStudentLessonsForWeek(getSupabase(), weekStart, child.id) : Promise.resolve([])),
    [child?.id, weekStart, mode],
  );

  const active = mode === "today" ? dayData : weekData;

  const weekByDay = useMemo(() => {
    const map = new Map<string, LessonWithSubject[]>();
    for (const l of weekData.data ?? []) {
      const key = l.starts_at.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [weekData.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={active.refreshing} onRefresh={active.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 21, fontWeight: "800", color: colors.textPrimary }}>{d.parentUi.scheduleTitle}</Text>
          </View>

          <View style={{ flexDirection: "row", backgroundColor: colors.chipBg, borderRadius: radii.sm, padding: 3, marginBottom: 16 }}>
            {([["today", d.common.today], ["week", d.common.week]] as const).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setMode(key)}
                style={{
                  flex: 1, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center",
                  backgroundColor: mode === key ? "#fff" : "transparent",
                  ...(mode === key ? shadow.soft : {}),
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: mode === key ? colors.primary : colors.textSecondary }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {!child ? (
            <EmptyState icon="calendar-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : active.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={active.refresh} />
          ) : active.loading ? (
            <ScreenSkeleton />
          ) : mode === "today" ? (
            (dayData.data ?? []).length === 0 ? (
              <EmptyState icon="calendar-outline" title={d.parentMobile.scheduleEmptyDay} description={d.parentMobile.comingSoonSection} />
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EFEAFF", borderRadius: radii.sm, padding: 12, marginBottom: 15 }}>
                  <Ionicons name="calendar" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#5A3ED0" }}>
                    {d.parentMobile.scheduleSummary.replace("{n}", String(dayData.data!.length))}
                  </Text>
                </View>
                {dayData.data!.map((l) => <LessonRow key={l.id} lesson={l} />)}
              </>
            )
          ) : weekByDay.length === 0 ? (
            <EmptyState icon="calendar-outline" title={d.parentUi.noLessonsWeek} description={d.parentMobile.comingSoonSection} />
          ) : (
            weekByDay.map(([dateStr, lessons]) => (
              <View key={dateStr} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "capitalize", marginBottom: 8 }}>
                  {fmtDay(dateStr)}
                </Text>
                {lessons.map((l) => <LessonRow key={l.id} lesson={l} />)}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
