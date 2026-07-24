/**
 * Экран #14 «Посещаемость» — REBUILD (Заход 5, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 584–622:
 *  585–589  InnerHeader с info-иконкой (без функции) в правом слоте.
 *  591      ChildSwitcherCard compact — триггер шторки выбора ребёнка.
 *  592–596  StatsRow: три плитки (зелёная 96%, оранжевая 2, красная 1).
 *           ВНИМАНИЕ: НЕТ плитки «Опоздания» — правило заказчика соблюдено.
 *  597–613  MonthCalendarCard: prev/next + сетка 7×5 (35 ячеек, стили ST по
 *           коду из макета 3807–3817) + легенда из 4 маркеров.
 *  614      SectionLabel uppercase «Последние дни».
 *  615–620  LastDaysList: 4 записи в одной glass-карточке с border-top-
 *           разделителями. Иконки-бэйджи справа: галочка / крестик / документ.
 *
 * Данные — через аксессоры src/data. Тексты — через useAppLocale().
 * Обе темы через useTheme(); iOS safe-area — из InnerHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar.
 *
 * Экран без FAB и без CTA-кнопок: интерактив — только ChildSwitcherCard
 * (openSheet) и стрелки календаря (prev/next меняют месяц в локальном state).
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  InnerHeader,
  type ChildPickerItem,
} from "../../ui";
import {
  getAttendanceLastDays,
  getAttendanceMonths,
  getAttendanceStats,
  getChildren,
  getSelectedChildContext,
} from "../../data";
import type { AttendanceCellCode } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Маппинг статуса записи «Последних дней» → цвет подписи + вид бэйджа.
 *  Порядок соответствует ATTENDANCE_LAST_DAYS (макет строки 616–619):
 *   0 «Присутствует»                    → green + галочка,
 *   1 «Присутствовал{suf}»              → green + галочка,
 *   2 «Отсутствовал{suf} без уважит.»   → red   + крестик,
 *   3 «Уважительная причина · справка»  → orange + документ. */
type BadgeKind = "check" | "x" | "doc";
const LAST_DAYS_META: { tone: "green" | "red" | "orange"; badge: BadgeKind }[] = [
  { tone: "green", badge: "check" },
  { tone: "green", badge: "check" },
  { tone: "red", badge: "x" },
  { tone: "orange", badge: "doc" },
];

/** Иконка «info» правого слота шапки (макет 588, 17×17 stroke 1.9). */
function InfoIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </Svg>
  );
}

/** Круглая кнопка prev/next заголовка календаря (макет 599/601, 28×28). */
function CalNavButton({ dir, onPress }: { dir: "prev" | "next"; onPress?: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.8)",
      }}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d={dir === "prev" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </Svg>
    </Pressable>
  );
}

/** Плитка статистики (одна из трёх, макет 593/594/595). */
function StatTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "green" | "orange" | "red";
}) {
  const { tokens } = useTheme();
  const st = tokens.status[tone];
  return (
    <View
      style={[
        {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderRadius: 16,
          alignItems: "center",
          gap: 2,
          backgroundColor: `rgba(${st.rgb},0.13)`,
          borderWidth: 1,
          borderColor: `rgba(${st.rgb},0.32)`,
        },
        shadowStyle({ x: 0, y: 10, blur: 22, color: `rgba(${st.rgb},0.14)` }),
      ]}
    >
      <Text style={{ fontFamily: fonts.unbounded600, fontSize: 19, color: st.text }}>{value}</Text>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: tokens.ink2, textAlign: "center" }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Ячейка календаря (макет 605): стиль зависит от кода AttendanceCellCode. */
function CalendarCell({ code, dayNumber }: { code: AttendanceCellCode; dayNumber: number | null }) {
  const { tokens } = useTheme();

  // Общий каркас 26×flex1, radius 8 (макет 3808 base).
  const base = {
    flex: 1,
    height: 26,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  // Пустая ячейка — прозрачно (макет 3810 e).
  if (code === "e") {
    return (
      <View style={base}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "transparent" }}>·</Text>
      </View>
    );
  }

  // «Сегодня» — акцентный градиент 135° + двойное кольцо (макет 3816 t).
  // Кольцо box-shadow (0 0 0 2px #fff, 0 0 0 3.5px #7c3aed) — приближаем
  // borderWidth 2 + внешним тонким outline через shadowStyle.
  if (code === "t") {
    const g = gradPoints(135);
    return (
      <View
        style={[
          {
            flex: 1,
            height: 26,
            borderRadius: 8,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          },
          shadowStyle({ x: 0, y: 0, blur: 6, color: "rgba(124,58,237,0.9)" }),
        ]}
      >
        <LinearGradient
          colors={["#7C3AED", "#4F6DF5"]}
          start={g.start}
          end={g.end}
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "#FFFFFF" }}>
            {dayNumber ?? ""}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Остальные коды: плоская заливка + белый / приглушённый текст.
  const styleByCode: Record<
    Exclude<AttendanceCellCode, "e" | "t">,
    { bg: string; color: string }
  > = {
    p: { bg: "rgba(16,185,129,0.72)", color: "#FFFFFF" },
    u: { bg: "rgba(249,115,22,0.78)", color: "#FFFFFF" },
    n: { bg: "rgba(239,68,68,0.78)", color: "#FFFFFF" },
    w: { bg: "rgba(23,18,67,0.05)", color: tokens.ink3 },
    f: { bg: "rgba(23,18,67,0.08)", color: tokens.ink3 },
  };
  const s = styleByCode[code];

  return (
    <View style={[base, { backgroundColor: s.bg }]}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: s.color }}>
        {dayNumber ?? ""}
      </Text>
    </View>
  );
}

/** Легенда календаря (макет 607–611). */
function LegendMarker({ color, label }: { color: string; label: string }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink2 }}>{label}</Text>
    </View>
  );
}

/** Круглый 24×24 бэйдж-иконка справа в строке «Последних дней». */
function LastDayBadge({ kind }: { kind: BadgeKind }) {
  const bg =
    kind === "check"
      ? "rgba(16,185,129,0.16)"
      : kind === "x"
        ? "rgba(239,68,68,0.13)"
        : "rgba(249,115,22,0.14)";
  const stroke = kind === "check" ? "#047857" : kind === "x" ? "#B91C1C" : "#C2410C";

  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      {kind === "check" ? (
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6 9 17l-5-5" />
        </Svg>
      ) : kind === "x" ? (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.8} strokeLinecap="round">
          <Path d="M18 6 6 18" />
          <Path d="m6 6 12 12" />
        </Svg>
      ) : (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <Path d="M14 3v5h5" />
        </Svg>
      )}
    </View>
  );
}

export default function AttendanceScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(
    () => session.currentChildId ?? children[0].id,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const stats = getAttendanceStats();
  const months = getAttendanceMonths();
  const lastDays = getAttendanceLastDays(childId);

  // Стартовый месяц — «Июль 2026» (index 1, макет 3906 default). Стрелки
  // переключают в пределах доступных месяцев (0..months.length-1).
  const [monthIndex, setMonthIndex] = useState<number>(months.length - 1);
  const activeMonth = months[monthIndex];

  // Дни календаря: код 'e' → пустая ячейка без числа; иначе — счётчик
  // (макет 3822–3826). Возвращает массив длиной 35.
  const calendarDays = useMemo(() => {
    let dayCounter = 0;
    return activeMonth.cells.map((code) => {
      if (code === "e") return { code, dayNumber: null as number | null };
      dayCounter += 1;
      return { code, dayNumber: dayCounter };
    });
  }, [activeMonth]);

  // Сетка 7×5: режем 35 ячеек на 5 рядов по 7 (гарантия равного flex 1
  // в каждой строке; grid-template-columns:repeat(7,1fr) — макет 603).
  const calendarRows = useMemo(() => {
    const rows: (typeof calendarDays)[] = [];
    for (let r = 0; r < 5; r += 1) rows.push(calendarDays.slice(r * 7, r * 7 + 7));
    return rows;
  }, [calendarDays]);

  const weekdayLabels = [t.date.mon, t.date.tue, t.date.wed, t.date.thu, t.date.fri, t.date.sat, t.date.sun];

  const pickerItems: ChildPickerItem[] = children.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${t.grades.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  const goPrevMonth = () => setMonthIndex((i) => Math.max(0, i - 1));
  const goNextMonth = () => setMonthIndex((i) => Math.min(months.length - 1, i + 1));

  return (
    <AppBackground>
      {/* Блок 1: TopBar — InnerHeader + info-иконка в правом слоте. */}
      <InnerHeader
        title={t.scr.attendance}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={<InfoIcon color={tokens.ink3} />}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* Блок 2: ChildSelectorCard (открывает шторку выбора ребёнка). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${t.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 3: StatsRow — 3 плитки (Посещаемость / Уважительные / Неуважительные). */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile value={`${stats.attendance_pct}%`} label={t.attend.present} tone="green" />
          <StatTile value={String(stats.excused_count)} label={t.attend.excused} tone="orange" />
          <StatTile value={String(stats.unexcused_count)} label={t.attend.unexcused} tone="red" />
        </View>

        {/* Блок 4: MonthCalendarCard. */}
        <GlassCard radius={20} contentStyle={{ padding: 13, gap: 10 }}>
          {/* Заголовок с стрелками. */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <CalNavButton dir="prev" onPress={goPrevMonth} />
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
              {activeMonth.label}
            </Text>
            <CalNavButton dir="next" onPress={goNextMonth} />
          </View>

          {/* Шапка дней недели + 5 рядов по 7 ячеек. */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {weekdayLabels.map((w) => (
                <Text
                  key={w}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: fonts.manrope800,
                    fontSize: 8.5,
                    color: tokens.ink3,
                  }}
                >
                  {w}
                </Text>
              ))}
            </View>
            {calendarRows.map((row, rowIdx) => (
              <View key={rowIdx} style={{ flexDirection: "row", gap: 4 }}>
                {row.map((cell, colIdx) => (
                  <CalendarCell key={`${rowIdx}-${colIdx}`} code={cell.code} dayNumber={cell.dayNumber} />
                ))}
              </View>
            ))}
          </View>

          {/* Легенда: 4 маркера (без «опоздания»). */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 9,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: "rgba(23,18,67,0.07)",
            }}
          >
            <LegendMarker color="rgba(16,185,129,0.75)" label={t.attend.legendPresent} />
            <LegendMarker color="rgba(249,115,22,0.8)" label={t.attend.legendExcused} />
            <LegendMarker color="rgba(239,68,68,0.8)" label={t.attend.legendUnexcused} />
            <LegendMarker color="rgba(23,18,67,0.08)" label={t.attend.legendWeekend} />
          </View>
        </GlassCard>

        {/* Блок 5: SectionLabel «Последние дни». */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: tokens.ink3,
          }}
        >
          {t.attend.lastDays}
        </Text>

        {/* Блок 6: LastDaysList — одна GlassCard, разделители border-top. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {lastDays.map((row, i) => {
            const meta = LAST_DAYS_META[i] ?? LAST_DAYS_META[0];
            const st = tokens.status[meta.tone];
            const bothNull = row.arrived_label === null && row.left_label === null;

            return (
              <View
                key={row.date_label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(23,18,67,0.07)",
                }}
              >
                <View style={{ flex: 1, flexDirection: "column" }}>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                    {row.date_label}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: st.text }}>
                    {row.status_label}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {bothNull ? (
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink3 }}>
                      — · —
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontFamily: fonts.manrope700,
                          fontSize: 10,
                          color: row.arrived_label ? tokens.ink2 : tokens.ink3,
                        }}
                      >
                        В школе: {row.arrived_label ?? "—"}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.manrope700,
                          fontSize: 10,
                          color: row.left_label ? tokens.ink2 : tokens.ink3,
                        }}
                      >
                        Уход: {row.left_label ?? "—"}
                      </Text>
                    </>
                  )}
                </View>
                <LastDayBadge kind={meta.badge} />
              </View>
            );
          })}
        </GlassCard>
      </ScrollView>

      {/* Шторка выбора ребёнка. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={childId}
          onSelect={(id) => {
            setChildId(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}
