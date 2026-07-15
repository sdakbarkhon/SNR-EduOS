import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getChildDailyStatus, formatTime, type DailyStatusLesson } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

const REFRESH_INTERVAL_MS = 60000;
const FUTURE_DOT_COLOR = "#3B9EFF";

function todayStr(): string {
  return new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

type LessonState = "past" | "active" | "future";

function lessonState(lesson: DailyStatusLesson, now: number): LessonState {
  const start = new Date(lesson.startsAt).getTime();
  const end = lesson.endsAt ? new Date(lesson.endsAt).getTime() : start + 45 * 60000;
  if (now >= start && now <= end) return "active";
  if (now > end) return "past";
  return "future";
}

/** Промт МОБ-7, v7 — Статус дня. Timeline сегодняшних уроков ребёнка с
 *  живым статусом (идёт/перемена/прошёл/впереди), пересчитывается раз в
 *  60с — только клиентское время, никакого дополнительного запроса. */
export default function DailyStatusScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, selectChild } = useParentData();
  const child = useSelectedChild();
  const [now, setNow] = useState(() => Date.now());

  const date = todayStr();
  const status = useAsyncData(
    () => (child ? getChildDailyStatus(getSupabase(), child.id, date) : Promise.resolve(null)),
    [child?.id, date],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

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

  const lessons = status.data?.lessons ?? [];
  // Ближайший урок в будущем (или ещё не закончившийся) — для подписи "Перемена, ещё N мин".
  const nextIdx = lessons.findIndex((l) => lessonState(l, now) !== "past");
  const inBreak = nextIdx > 0 && lessonState(lessons[nextIdx], now) === "future"
    && now > new Date(lessons[nextIdx - 1].endsAt ?? lessons[nextIdx - 1].startsAt).getTime();
  const minutesToNext = nextIdx >= 0
    ? Math.max(0, Math.round((new Date(lessons[nextIdx].startsAt).getTime() - now) / 60000))
    : null;

  const weekdayLabel = new Date(`${date}T12:00:00+05:00`).toLocaleDateString(locale, { weekday: "long", timeZone: "Asia/Tashkent" });
  const dateLabel = new Date(`${date}T12:00:00+05:00`).toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "Asia/Tashkent" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={status.refreshing} onRefresh={status.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.dailyStatusTitle}</Text>
            {parentCtx && parentCtx.children.length > 1 ? (
              <Pressable
                onPress={onSwitchChild}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
              >
                <Ionicons name="swap-horizontal" size={19} color={colors.primary} />
              </Pressable>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>

          {!child ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : status.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={status.refresh} />
          ) : status.loading || !status.data ? (
            <ScreenSkeleton />
          ) : (
            <>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.lg, ...shadow.soft }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>{initials(child.fullName)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: colors.textPrimary }}>{child.fullName}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{child.className ?? d.common.none}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, textTransform: "capitalize" }}>{weekdayLabel}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{dateLabel}</Text>
                </View>
              </View>

              {status.data.isDayOff ? (
                <View style={{ alignItems: "center", paddingTop: 40 }}>
                  <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
                    <Ionicons name="sunny-outline" size={36} color={colors.success} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: 6 }}>{d.parentMobile.dailyStatusDayOffTitle}</Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary, textAlign: "center" }}>{d.parentMobile.dailyStatusDayOffDesc}</Text>
                </View>
              ) : (
                <>
                  {/* Пришёл в школу — мок-заглушка автотрекинга */}
                  <TimelineRow
                    first
                    dotColor={colors.textFaint}
                    time="08:15"
                    title={d.parentMobile.dailyStatusArrivedTitle}
                    subtitle={d.parentMobile.dailyStatusArrivedMock}
                    dim
                  />

                  {lessons.map((lesson, i) => {
                    const state = lessonState(lesson, now);
                    const isNextInBreak = inBreak && i === nextIdx;
                    const dotColor = state === "active" ? colors.success : state === "past" ? colors.textFaint : FUTURE_DOT_COLOR;
                    const timeRange = `${formatTime(lesson.startsAt, locale)}${lesson.endsAt ? `–${formatTime(lesson.endsAt, locale)}` : ""}`;
                    return (
                      <TimelineRow
                        key={lesson.id}
                        dotColor={dotColor}
                        pulse={state === "active"}
                        dim={state === "past"}
                        time={timeRange}
                        title={lesson.title}
                        subtitle={[lesson.room, lesson.teacherName].filter(Boolean).join(" · ")}
                        badge={
                          state === "active" ? d.parentMobile.dailyStatusOnLesson
                          : isNextInBreak && minutesToNext != null ? formatMinutes(d.parentMobile.dailyStatusBreakLabel, minutesToNext)
                          : state === "past" ? attendanceLabel(lesson.attendanceStatus, d)
                          : undefined
                        }
                        badgeColor={state === "active" ? colors.success : isNextInBreak ? colors.textSecondary : attendanceColor(lesson.attendanceStatus)}
                      />
                    );
                  })}

                  {/* Итоги дня */}
                  <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 16, marginTop: spacing.md, ...shadow.soft }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginBottom: 12 }}>{d.parentMobile.dailyStatusSummaryTitle}</Text>
                    <SummaryRow label={d.parentMobile.dailyStatusSummaryTotal} value={String(status.data.totalLessons)} />
                    <SummaryRow label={d.parentMobile.dailyStatusSummaryAttended} value={String(status.data.attendedCount)} valueColor={colors.success} />
                    <SummaryRow
                      label={d.parentMobile.dailyStatusSummaryMissed}
                      value={String(status.data.missedCount)}
                      valueColor={status.data.missedCount > 0 ? colors.danger : colors.textPrimary}
                      last={status.data.gradesToday.length === 0 && status.data.homeworkAssignedToday === 0}
                    />
                    {status.data.gradesToday.length > 0 && (
                      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>{d.parentMobile.dailyStatusSummaryGrades}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {status.data.gradesToday.map((g, i) => (
                            <View key={i} style={{ backgroundColor: colors.successBg, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9, flexDirection: "row", gap: 5 }}>
                              <Text style={{ fontSize: 11.5, color: colors.textPrimary }}>{g.subjectName}</Text>
                              <Text style={{ fontSize: 11.5, fontWeight: "800", color: colors.success }}>{g.grade}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    {status.data.homeworkAssignedToday > 0 && (
                      <SummaryRow label={d.parentMobile.dailyStatusSummaryHomework} value={String(status.data.homeworkAssignedToday)} last />
                    )}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatMinutes(template: string, n: number): string {
  return template.replace("{n}", String(n));
}

function attendanceLabel(status: DailyStatusLesson["attendanceStatus"], d: ReturnType<typeof useAppLocale>["d"]): string | undefined {
  if (status === "present") return d.parentUi.statusPresent;
  if (status === "absent_excused" || status === "absent_unexcused") return d.parentUi.statusAbsent;
  return undefined;
}
function attendanceColor(status: DailyStatusLesson["attendanceStatus"]): string {
  if (status === "present") return colors.success;
  if (status === "absent_excused" || status === "absent_unexcused") return colors.danger;
  return colors.textMuted;
}

function SummaryRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "800", color: valueColor ?? colors.textPrimary }}>{value}</Text>
    </View>
  );
}

function TimelineRow({ dotColor, pulse, dim, first, time, title, subtitle, badge, badgeColor }: {
  dotColor: string; pulse?: boolean; dim?: boolean; first?: boolean;
  time: string; title: string; subtitle?: string; badge?: string; badgeColor?: string;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  return (
    <View style={{ flexDirection: "row", opacity: dim ? 0.6 : 1 }}>
      <View style={{ width: 22, alignItems: "center" }}>
        {!first && <View style={{ position: "absolute", top: -14, bottom: "50%", width: 2, backgroundColor: colors.border }} />}
        <View style={{ position: "absolute", top: "50%", bottom: -14, width: 2, backgroundColor: colors.border }} />
        <View style={{ marginTop: 22, width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor, alignItems: "center", justifyContent: "center" }}>
          {pulse && (
            <Animated.View style={{ position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor, opacity: 0.4, transform: [{ scale: pulseAnim }] }} />
          )}
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, marginLeft: 10, marginBottom: 10, ...shadow.soft }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.textMuted }}>{time}</Text>
          {badge && (
            <View style={{ backgroundColor: (badgeColor ?? colors.textMuted) + "22", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: badgeColor ?? colors.textMuted }}>{badge}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 3 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
