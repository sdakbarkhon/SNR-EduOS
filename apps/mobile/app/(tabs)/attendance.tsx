import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  attendanceCalcAll,
  attendanceForDay,
  defaultLocale,
  getAttendanceWithLesson,
  getDictionary,
  getSubjectStyle,
  type AttendanceWithLesson,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { Screen, SubjectIcon } from "../../components";
import { getSupabase } from "../../lib/supabase";

const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Цвет рамки по статусу: absent > late > present */
function getStatusBorderColor(dayRows: AttendanceWithLesson[]): string | null {
  if (dayRows.length === 0) return null;
  if (dayRows.some((r) => r.status === "absent")) return colors.danger;
  if (dayRows.some((r) => r.status === "late")) return colors.warning;
  if (dayRows.some((r) => r.status === "present")) return colors.success;
  return null;
}

function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: new Date(year, month, 1).toISOString(),
    to: new Date(year, month + 1, 1).toISOString(),
  };
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const start = new Date(firstDay);
  start.setDate(start.getDate() + mondayOffset);
  const endDow = lastDay.getDay();
  const sundayOffset = endDow === 0 ? 0 : 7 - endDow;
  const end = new Date(lastDay);
  end.setDate(end.getDate() + sundayOffset);
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function AttendanceScreen() {
  const d = getDictionary(defaultLocale);
  const sb = getSupabase();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<AttendanceWithLesson[]>([]);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const data = await getAttendanceWithLesson(sb, monthRange(y, m));
      setRows(data);
    },
    [sb],
  );

  useEffect(() => {
    loadMonth(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const range = monthRange(year, month);
    const channel = sb
      .channel("mobile-attendance-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        async () => {
          const fresh = await getAttendanceWithLesson(sb, range);
          setRows(fresh);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [year, month, sb]);

  const prevMonth = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setMonth(m);
    setYear(y);
    loadMonth(y, m);
  };

  const nextMonth = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setMonth(m);
    setYear(y);
    loadMonth(y, m);
  };

  const stats = useMemo(() => attendanceCalcAll(rows), [rows]);
  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const LEGEND = [
    { color: colors.success, label: d.attendance.legendPresent },
    { color: colors.danger,  label: d.attendance.legendAbsent },
    { color: colors.warning, label: d.attendance.legendLate },
  ];

  return (
    <Screen title={d.attendance.title}>
      {/* Переключатель месяца */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bgCard,
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 4,
          alignSelf: "center",
          marginBottom: 20,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <Pressable
          onPress={prevMonth}
          style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 18 }}
        >
          <Text style={{ fontSize: 20, color: colors.textPrimary }}>‹</Text>
        </Pressable>
        <Text style={{ minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
          {MONTH_NAMES_RU[month]} {year}
        </Text>
        <Pressable
          onPress={nextMonth}
          style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 18 }}
        >
          <Text style={{ fontSize: 20, color: colors.textPrimary }}>›</Text>
        </Pressable>
      </View>

      {/* KPI-стрип */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 20 }}
        contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      >
        {[
          { label: d.attendance.kpiOverall, value: `${stats.overall}%`, color: colors.success },
          { label: d.attendance.kpiDays, value: `${stats.daysWithoutAbsence} ${d.attendance.daysUnit}`, color: colors.primary },
          { label: d.attendance.kpiMissed, value: `${stats.missed} ${d.attendance.lessonsUnit}`, color: colors.warning },
        ].map((card) => (
          <View
            key={card.label}
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 20,
              padding: 16,
              minWidth: 140,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "500", color: colors.textMuted, marginBottom: 4 }}>
              {card.label}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: card.color }}>
              {card.value}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Календарь */}
      <View
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: 20,
          padding: 16,
          marginBottom: 20,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 1,
        }}
      >
        {/* Заголовок + легенда */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>
            {d.attendance.calendarTitle}
          </Text>
          <View style={{ gap: 4 }}>
            {LEGEND.map((l) => (
              <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                {/* Цветной квадратик */}
                <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: l.color }} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Заголовки дней */}
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          {DAY_LABELS.map((label) => (
            <Text
              key={label}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
              }}
            >
              {label}
            </Text>
          ))}
        </View>

        {/* Сетка — рамки вместо точек */}
        {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, wi) => (
          <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
            {calendarDays.slice(wi * 7, wi * 7 + 7).map((day) => {
              const inMonth = day.getMonth() === month;
              const isToday =
                `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` === todayKey;
              const dayRows = attendanceForDay(rows, day);
              const borderColor = inMonth ? getStatusBorderColor(dayRows) : null;

              return (
                <View key={day.toISOString()} style={{ flex: 1, alignItems: "center", paddingVertical: 2 }}>
                  {/* Внешнее кольцо статуса (только для today+status) */}
                  <View
                    style={{
                      borderRadius: isToday ? 16 : 7,
                      borderWidth: isToday && borderColor ? 2 : 0,
                      borderColor: isToday && borderColor ? borderColor : "transparent",
                      padding: isToday && borderColor ? 2 : 0,
                    }}
                  >
                    {/* Ячейка дня */}
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: isToday ? 14 : 6,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: isToday ? colors.primary : "transparent",
                        // Цветная рамка для не-сегодня
                        borderWidth: !isToday && inMonth && borderColor ? 2 : 0,
                        borderColor: !isToday && inMonth && borderColor ? borderColor : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isToday ? "700" : "400",
                          color: isToday
                            ? "#fff"
                            : inMonth
                            ? colors.textPrimary
                            : colors.textMuted,
                          opacity: inMonth ? 1 : 0.35,
                        }}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* По предметам */}
      <View
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: 20,
          padding: 16,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 1,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 16 }}>
          {d.attendance.bySubjectTitle}
        </Text>
        {stats.bySubject.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 16 }}>
            {d.attendance.empty}
          </Text>
        ) : (
          stats.bySubject.map(({ subject, pct }) => {
            const style = getSubjectStyle(subject);
            return (
              <View key={subject} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: "rgba(255,255,255,0.6)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.5)",
                      justifyContent: "center",
                      alignItems: "center",
                      shadowColor: "#000",
                      shadowOpacity: 0.06,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <SubjectIcon subject={subject} size={20} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>
                    {style.label}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: style.color }}>
                    {pct}%
                  </Text>
                </View>
                {/* h-2.5 аналог из zip: высота 10px, shadow-inner через low opacity bg */}
                <View style={{ height: 10, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 5, overflow: "hidden" }}>
                  <View
                    style={{ width: `${pct}%`, height: "100%", backgroundColor: style.color, borderRadius: 5 }}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}
