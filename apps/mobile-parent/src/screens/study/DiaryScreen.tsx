/**
 * ddiary «Дневник» — заход после 8 (фикс), block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 1511–1535.
 *
 * Порядок блоков:
 *  1512–1516  HeaderBar: back-glass 38 + title t.svc.diary + right
 *             calendar-glass 38 (goDatepick → DatePickerSheet).
 *  1518       ChildSwitcherCard compact row — открывает шторку выбора ребёнка
 *             (тот же паттерн, что и во всех остальных экранах захода 8).
 *  1519–1523  WeekNavRow: prev-круг 28×28 / label «{неделя}» 13/800 / next-круг.
 *             Локальный state weekIndex по getDiaryWeeks() (2 недели фикстуры).
 *  1524–1530  WeekStatsCard: непрозрачный градиент 135° #7c3aed→#4f6df5,
 *             3 колонки (ОЦЕНОК ПОЛУЧЕНО / СР. БАЛЛ НЕДЕЛИ / ЗАДАНИЙ СДАНО) —
 *             значения из активной недели (grades_count_label/avg_label/
 *             homework_label), разделители 1px.
 *  1531–1533  DiaryRows: по дням недели (day_label + avg_label) → под каждым
 *             днём список уроков (предметная плитка-иконка + тема + Д/З +
 *             оценка-чип). Мокап рисует единый плоский sc-for diaryRows —
 *             в реализации сгруппировано по дню, т.к. DiaryDayRow.day_label/
 *             avg_label осмысленны только как заголовок группы, не поля
 *             каждой строки.
 *
 * Данные — getChildren/getSelectedChildContext (ребёнок), getDiaryWeeks()
 * (недели), getSubject() (цвет/иконка предмета). Обе темы — useTheme().
 * DatePickerSheet — уже готовый компонент (заход 5); выбранный день
 * определяет неделю (день ≥ 20 → неделя «20–26 июля», иначе «13–19 июля» —
 * единственная осмысленная интерпретация в границах 2-недельной фикстуры).
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  StatusChip,
  type ChildPickerItem,
} from "../../ui";
import {
  DEMO_TODAY,
  getChildren,
  getDiaryWeeks,
  getSelectedChildContext,
  getSubject,
} from "../../data";
import type { DiaryDayRow } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import DatePickerSheet from "./sheets/DatePickerSheet";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

function ChevronIcon({ direction, color }: { direction: "left" | "right"; color: string }) {
  const d = direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6";
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Path d="M3 4h18v17a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V4Z" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

/** Строка одного урока в дневнике (макет 1532). */
function DiaryLessonRow({
  subject_id,
  topic,
  homework_label,
  grade,
  divider,
}: {
  subject_id: DiaryDayRow["lessons"][number]["subject_id"];
  topic: string;
  homework_label: string;
  grade: number | null;
  divider: boolean;
}) {
  const { tokens, scheme } = useTheme();
  const subject = getSubject(subject_id);
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 9,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: dividerColor,
      }}
    >
      <LinearGradient
        colors={subject.gradient}
        {...gradPoints(135)}
        style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#fff" }}>
          {subject.name.slice(0, 1)}
        </Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {topic}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}>
          {homework_label}
        </Text>
      </View>
      {grade != null ? (
        <StatusChip
          label={String(grade)}
          family={grade >= 5 ? "green" : grade >= 4 ? "blue" : grade >= 3 ? "orange" : "red"}
        />
      ) : null}
    </View>
  );
}

export default function DiaryScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(() => session.currentChildId ?? children[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [datePickOpen, setDatePickOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const weeks = getDiaryWeeks();
  // Неделя по умолчанию — та, что содержит DEMO_TODAY (самая свежая, index
  // максимальный среди фикстуры), не хардкод индекса.
  const defaultWeekIdx = weeks.reduce(
    (best, w, i) => (w.week_index > weeks[best].week_index ? i : best),
    0,
  );
  const [weekIdx, setWeekIdx] = useState<number>(defaultWeekIdx);
  const week = weeks[weekIdx];

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

  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";

  return (
    <AppBackground>
      <InnerHeader
        title={t.svc.diary}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => setDatePickOpen(true)}>
            <CalendarIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {/* Блок 2: ChildSwitcherCard compact row. */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
          name={child.full_name}
          classLabel={`${child.class_name} ${t.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 3: WeekNavRow. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
            disabled={weekIdx >= weeks.length - 1}
            hitSlop={6}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.55)",
              borderWidth: 1,
              borderColor: scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.8)",
              opacity: weekIdx >= weeks.length - 1 ? 0.4 : 1,
            }}
          >
            <ChevronIcon direction="left" color={tokens.ink1} />
          </Pressable>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
            {week.label}
          </Text>
          <Pressable
            onPress={() => setWeekIdx((i) => Math.max(0, i - 1))}
            disabled={weekIdx <= 0}
            hitSlop={6}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.55)",
              borderWidth: 1,
              borderColor: scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.8)",
              opacity: weekIdx <= 0 ? 0.4 : 1,
            }}
          >
            <ChevronIcon direction="right" color={tokens.ink1} />
          </Pressable>
        </View>

        {/* Блок 4: WeekStatsCard. */}
        <View
          style={[
            {
              flexDirection: "row",
              gap: 8,
              padding: 14,
              borderRadius: 20,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.35)" }),
          ]}
        >
          <LinearGradient colors={["#7c3aed", "#4f6df5"]} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.35)" }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, color: "rgba(255,255,255,0.75)" }}>
              ОЦЕНОК ПОЛУЧЕНО
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>{week.grades_count_label}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, color: "rgba(255,255,255,0.75)" }}>
              СР. БАЛЛ НЕДЕЛИ
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>{week.avg_label}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, color: "rgba(255,255,255,0.75)" }}>
              ЗАДАНИЙ СДАНО
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>{week.homework_label}</Text>
          </View>
        </View>

        {/* Блок 5: DiaryRows, сгруппированные по дню. */}
        {week.days.map((day) => (
          <View key={day.day_label} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10.5,
                  letterSpacing: 10.5 * 0.08,
                  textTransform: "uppercase",
                  color: tokens.ink3,
                }}
              >
                {day.day_label}
              </Text>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                {day.avg_label}
              </Text>
            </View>
            <GlassCard radius={18} contentStyle={{ paddingVertical: 2, paddingHorizontal: 12 }}>
              {day.lessons.map((lesson, i) => (
                <DiaryLessonRow
                  key={`${lesson.subject_id}-${i}`}
                  subject_id={lesson.subject_id}
                  topic={lesson.topic}
                  homework_label={lesson.homework_label}
                  grade={lesson.grade}
                  divider={i > 0}
                />
              ))}
            </GlassCard>
          </View>
        ))}
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

      {/* Шторка выбора даты — переключает неделю по границе 20 июля
          (13–19 vs 20–26), единственный осмысленный маппинг в пределах
          двухнедельной фикстуры. */}
      <DatePickerSheet
        visible={datePickOpen}
        onClose={() => setDatePickOpen(false)}
        initialMonthIndex={DEMO_TODAY.month_index}
        initialDay={DEMO_TODAY.day}
        onApply={(_monthIndex, day) => {
          const targetWeekIndex = day >= 20 ? 1 : 0;
          const idx = weeks.findIndex((w) => w.week_index === targetWeekIndex);
          if (idx >= 0) setWeekIdx(idx);
        }}
      />
    </AppBackground>
  );
}
