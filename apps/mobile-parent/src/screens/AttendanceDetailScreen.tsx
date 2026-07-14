import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getChildAttendanceDetail, type AttendanceStatus, type ChildAttendanceDetail } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

// Без "опозданий" — статус 'late' убран из БД (см. комментарий у
// getChildAttendanceDetail в packages/core). Ровно 3 состояния + "нет
// данных"/выходной, никакого жёлтого нигде на этом экране.
const MONTH_NAMES: Record<"ru" | "en" | "uz", string[]> = {
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
};

const WEEKDAY_LABELS: Record<"ru" | "en" | "uz", string[]> = {
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
};

// Родительный падеж для фразы "15 мая" в "Последних днях" — именительный
// "Май" там грамматически неверен. На заголовок календаря не влияет (там
// именительный "Май 2024" — корректен).
const RU_MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Сдвиг "YYYY-MM" на N месяцев. day=1 у обоих Date — не зависит от длины месяца. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Локальная (не UTC) полночь для "YYYY-MM-DD" — избегает сдвига даты на
 *  устройствах с TZ левее UTC, который дал бы new Date("YYYY-MM-DD"). */
function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDayDate(dateStr: string, locale: "ru" | "en" | "uz"): string {
  const d = parseDateStr(dateStr);
  const monthName = locale === "ru" ? RU_MONTHS_GENITIVE[d.getMonth()] : MONTH_NAMES[locale][d.getMonth()].toLowerCase();
  return `${d.getDate()} ${monthName}`;
}

type StatusVisual = { bg: string; color: string; labelKey: string };

function statusVisual(status: AttendanceStatus, d: ReturnType<typeof useAppLocale>["d"]): StatusVisual {
  switch (status) {
    case "present":
      return { bg: colors.successBg, color: colors.success, labelKey: d.parentMobile.attCalendarLegendPresent };
    case "absent_excused":
      return { bg: "#EFEAFF", color: colors.primaryLight, labelKey: d.parentMobile.attCalendarLegendExcused };
    case "absent_unexcused":
      return { bg: colors.dangerBg, color: colors.danger, labelKey: d.parentMobile.attCalendarLegendUnexcused };
  }
}

export default function AttendanceDetailScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "AttendanceDetail">>();
  const { childId } = route.params;

  const { data: parentCtx, loading: parentLoading, error: parentError, refresh: refreshParent } = useParentData();
  const child = parentCtx?.children.find((c) => c.id === childId) ?? null;

  const [month, setMonth] = useState(currentMonthStr());

  const attendance = useAsyncData<ChildAttendanceDetail>(
    () => getChildAttendanceDetail(getSupabase(), childId, month),
    [childId, month],
  );

  const loading = parentLoading || attendance.loading;
  const error = parentError ?? attendance.error;
  const refreshing = parentLoading || attendance.refreshing;

  function onRefresh() {
    refreshParent();
    attendance.refresh();
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return `${MONTH_NAMES[locale][m - 1]} ${y}`;
  }, [month, locale]);

  const calendarCells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0=Пн
    const byDate = new Map((attendance.data?.days ?? []).map((day) => [day.date, day]));
    const cells: Array<{ key: string; dayNum: number | null; status: AttendanceStatus | null }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ key: `pad-${i}`, dayNum: null, status: null });
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${y}-${pad2(m)}-${pad2(dayNum)}`;
      cells.push({ key: dateStr, dayNum, status: byDate.get(dateStr)?.status ?? null });
    }
    return cells;
  }, [month, attendance.data]);

  const recentDays = useMemo(() => (attendance.data?.days ?? []).slice(-14).reverse(), [attendance.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
              {d.parentMobile.attDetailTitle}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {!child && !parentLoading && !parentError ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={onRefresh} />
          ) : loading || !child ? (
            <ScreenSkeleton />
          ) : (
            <>
              {/* Мини-карточка ребёнка */}
              <View style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 10, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md, ...shadow.soft }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>{initials(child.fullName)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{child.fullName}</Text>
                  {child.className ? <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginTop: 1 }}>{child.className}</Text> : null}
                </View>
              </View>

              {/* Статистика: 3 плитки, БЕЗ жёлтого/опозданий — статуса 'late' в БД больше нет */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.lg }}>
                <View style={{ flex: 1.15, backgroundColor: colors.successBg, borderRadius: radii.lg, padding: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.success, marginBottom: 4 }}>{d.parentMobile.progAttendanceLabel}</Text>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.success, lineHeight: 27 }}>{attendance.data?.stats.percentage ?? 0}%</Text>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: colors.success, marginTop: 5, opacity: 0.85 }}>{d.parentMobile.attThisMonth}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#EFEAFF", borderRadius: radii.lg, padding: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primaryLight, marginBottom: 4 }}>{d.parentMobile.attExcusedLabel}</Text>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.primaryLight, lineHeight: 27 }}>{attendance.data?.stats.excused ?? 0}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: colors.primaryLight, marginTop: 5, opacity: 0.85 }}>{d.parentMobile.attThisMonth}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.dangerBg, borderRadius: radii.lg, padding: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.danger, marginBottom: 4 }}>{d.parentMobile.attUnexcusedLabel}</Text>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.danger, lineHeight: 27 }}>{attendance.data?.stats.unexcused ?? 0}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: colors.danger, marginTop: 5, opacity: 0.85 }}>{d.parentMobile.attThisMonth}</Text>
                </View>
              </View>

              {/* Календарь */}
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, marginBottom: spacing.lg, ...shadow.card }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Pressable
                    onPress={() => setMonth((m) => shiftMonth(m, -1))}
                    style={({ pressed }) => [{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.chipBg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="chevron-back" size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textPrimary }}>{monthLabel}</Text>
                  <Pressable
                    onPress={() => setMonth((m) => shiftMonth(m, 1))}
                    style={({ pressed }) => [{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.chipBg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: "row", marginBottom: 4 }}>
                  {WEEKDAY_LABELS[locale].map((wd, i) => (
                    <Text key={i} style={{ width: `${100 / 7}%`, textAlign: "center", fontSize: 9.5, fontWeight: "700", color: colors.textFaint, paddingVertical: 4 }}>
                      {wd}
                    </Text>
                  ))}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {calendarCells.map((cell) => {
                    const visual = cell.status ? statusVisual(cell.status, d) : null;
                    return (
                      <View key={cell.key} style={{ width: `${100 / 7}%`, alignItems: "center", justifyContent: "center", paddingVertical: 2.5 }}>
                        {cell.dayNum != null && (
                          <View
                            style={{
                              width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center",
                              backgroundColor: visual?.bg ?? "transparent",
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: visual ? "800" : "500", color: visual?.color ?? colors.textFaint }}>
                              {cell.dayNum}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <LegendItem color={colors.success} label={d.parentMobile.attCalendarLegendPresent} />
                  <LegendItem color={colors.primaryLight} label={d.parentMobile.attCalendarLegendExcused} />
                  <LegendItem color={colors.danger} label={d.parentMobile.attCalendarLegendUnexcused} />
                  <LegendItem color={colors.chipBg} borderColor={colors.textFaint} label={d.parentMobile.attCalendarLegendNone} />
                </View>
              </View>

              {/* Последние дни */}
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 }}>{d.parentMobile.attRecentDaysTitle}</Text>
              {recentDays.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{d.parentMobile.attRecentDaysEmpty}</Text>
              ) : (
                recentDays.map((day) => {
                  const visual = statusVisual(day.status, d);
                  const time = fmtTime(day.markedAt);
                  const isPresent = day.status === "present";
                  return (
                    <View
                      key={day.date}
                      style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 9, ...shadow.soft }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                          {fmtDayDate(day.date, locale)}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: visual.color, marginTop: 2 }}>{visual.labelKey}</Text>
                      </View>
                      {time && (
                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>{time}</Text>
                      )}
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: visual.bg, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={isPresent ? "checkmark" : "close"} size={13} color={visual.color} />
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LegendItem({ color, label, borderColor }: { color: string; label: string; borderColor?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color, borderWidth: borderColor ? 1 : 0, borderColor }} />
      <Text style={{ fontSize: 9.5, fontWeight: "600", color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}
