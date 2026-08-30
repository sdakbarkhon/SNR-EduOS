/**
 * ddiary «Дневник» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: две недели из фикстуры `DIARY_WEEKS`, стрелки листали между ними, а
 * шторка выбора даты переключала неделю по границе «день ≥ 20». Ни одна цифра
 * на экране не приходила из базы.
 *
 * СТАЛО: `getChildDiaryWeek` из @snr/core — тот же запрос, что питает
 * «Дневник» на вебе (apps/web/app/parent/(app)/diary). Дневник — вид поверх
 * готового: уроки группы ребёнка за неделю плюс его оценки за эти уроки.
 * Своей сущности «дневник» в базе нет и заводить её не надо.
 *
 * Композиция макета сохранена: карточка ребёнка, переключатель недели,
 * непрозрачная карточка итогов, дальше дни и уроки внутри дня.
 *
 * ЧЕГО НЕТ ПО СРАВНЕНИЮ С МАКЕТОМ — строки «Д/З» под уроком. Связь задания с
 * уроком (`homework.lesson_id`) в базе не заполнена, и приписать задание к
 * уроку можно было бы только на глаз. Сданные работы посчитаны в шапке
 * недели, где они честные. Вместо «Д/З» под уроком стоит комментарий учителя
 * к оценке — он настоящий и в дневнике к месту.
 *
 * Кнопка календаря в шапке возвращает на текущую школьную неделю (шторка
 * выбора даты знала только две фикстурные недели и ушла вместе с ними).
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  format,
  getChildDiaryWeek,
  getStudentLessonsForWeek,
  LOCALE_TAG,
  type DiaryLesson,
} from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  LoadingBlock,
  StatusChip,
} from "../../ui";
import { useChildQuery } from "../../hooks/useChildScope";
import { useShowcaseChild } from "../../hooks/useShowcaseChild";
import { getDiaryWeeks, getSubject } from "../../data";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { addDays, mondayOfWeek } from "../../lib/tashkent";
import { dayMonth, hexToRgbCsv, weekdayDayMonth } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

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

/** Цвет чипа оценки: 5 — зелёный, 4 — синий, 3 — оранжевый, ниже — красный. */
function gradeFamily(grade: number): "green" | "blue" | "orange" | "red" {
  if (grade >= 5) return "green";
  if (grade >= 4) return "blue";
  if (grade >= 3) return "orange";
  return "red";
}

/** Строка одного урока в дневнике (макет 1532). */
function DiaryLessonRow({ lesson, divider }: { lesson: DiaryLesson; divider: boolean }) {
  const { tokens, scheme } = useTheme();
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  // Цвет предмета — из базы (subjects.color). Градиента у предмета там нет,
  // поэтому плитка заливается одним цветом с лёгким осветлением сверху —
  // тот же приём, что уже применён в расписании для реальных уроков.
  const color = lesson.subjectColor ?? tokens.accent;
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
        colors={[color, color]}
        {...gradPoints(135)}
        style={[
          { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
          shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${hexToRgbCsv(color)},0.3)` }),
        ]}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#fff" }}>
          {lesson.subjectName.slice(0, 1)}
        </Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {lesson.topic ?? lesson.subjectName}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}>
          {lesson.comment ?? lesson.subjectName}
        </Text>
      </View>
      {lesson.grade != null ? (
        <StatusChip label={String(lesson.grade)} family={gradeFamily(lesson.grade)} />
      ) : null}
    </View>
  );
}

export default function DiaryScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m2 = t.more2;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();

  const sc = t.showcase;
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Витрина: две недели макета. Средние баллы дней считаются по оценкам
  // самих дней; три числа шапки недели отдаются подписями — список дней в
  // макете неполный, см. getDiaryWeeks.
  const scWeeks = getDiaryWeeks(locale);
  const [scWeekIndex, setScWeekIndex] = useState(scWeeks[0]?.index ?? 1);
  const scWeek = scWeeks.find((w) => w.index === scWeekIndex) ?? scWeeks[0];
  const scIndexes = scWeeks.map((w) => w.index);

  // Неделя школьного «сегодня» — стартовая. Пересчитывается, когда дата школы
  // приезжает из базы (useTashkentToday подписан на неё), поэтому дневник не
  // открывается на настоящей неделе, а потом не прыгает на школьную.
  const todayKey = useTashkentToday();
  const currentMonday = mondayOfWeek(todayKey);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const activeWeek = weekStart ?? currentMonday;

  const state = useChildQuery(
    realChildId,
    async (db, id) => {
      const lessons = await getStudentLessonsForWeek(db, activeWeek, id);
      return getChildDiaryWeek(db, id, activeWeek, lessons);
    },
    [activeWeek],
  );

  const weekLabel = useMemo(
    () => `${dayMonth(activeWeek, localeTag)} — ${dayMonth(addDays(activeWeek, 6), localeTag)}`,
    [activeWeek, localeTag],
  );

  const week = state.data;
  const navButtonStyle = {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.8)",
  };

  return (
    <AppBackground>
      <InnerHeader
        title={t.svc.diary}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => setWeekStart(currentMonday)}>
            <CalendarIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {/* Карточка ребёнка — переключатель семьи. */}
        {child ? (
          <ChildSwitcherCard
            variant="compact"
            avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
            name={child.full_name}
            classLabel={`${child.class_name} ${t.grades.class}`}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}

        {/* Переключатель недели. В показе листаем между двумя неделями
            макета и не дальше — третьей там нет. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() =>
              showcase
                ? setScWeekIndex((i) => (scIndexes.includes(i - 1) ? i - 1 : i))
                : setWeekStart(addDays(activeWeek, -7))
            }
            hitSlop={6}
            style={navButtonStyle}
          >
            <ChevronIcon direction="left" color={tokens.ink1} />
          </Pressable>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
            {showcase ? scWeek.label : weekLabel}
          </Text>
          <Pressable
            onPress={() =>
              showcase
                ? setScWeekIndex((i) => (scIndexes.includes(i + 1) ? i + 1 : i))
                : setWeekStart(addDays(activeWeek, 7))
            }
            hitSlop={6}
            style={navButtonStyle}
          >
            <ChevronIcon direction="right" color={tokens.ink1} />
          </Pressable>
        </View>

        {/* Итоги недели — единственное непрозрачное пятно экрана. */}
        <View
          style={[
            { flexDirection: "row", gap: 8, padding: 14, borderRadius: 20, overflow: "hidden" },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.35)" }),
          ]}
        >
          <LinearGradient colors={["#7c3aed", "#4f6df5"]} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.35)" }} />
          {(showcase
            ? [
                { cap: sc.gradesReceivedCap, value: scWeek.grades_label },
                { cap: sc.weekAvgCap, value: scWeek.avg_label },
                { cap: sc.homeworkDoneCap, value: scWeek.homework_label },
              ]
            : [
                { cap: m2.diaryWeekGrades, value: String(week?.gradeCount ?? 0) },
                { cap: m2.diaryWeekAvg, value: week?.average != null ? week.average.toFixed(1) : m2.diaryNoGrade },
                { cap: m2.diaryWeekHw, value: String(week?.homeworkSubmitted ?? 0) },
              ]
          ).map((c, i) => (
            <View key={c.cap} style={{ flex: 1, flexDirection: "row" }}>
              {i > 0 ? <View style={{ width: 1, marginRight: 8, backgroundColor: "rgba(255,255,255,0.2)" }} /> : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
                  {c.cap}
                </Text>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>{c.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Дни недели. */}
        {showcase ? (
          scWeek.days.map((day) => (
            <View key={day.label} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontFamily: fonts.manrope800,
                    fontSize: 10,
                    letterSpacing: 10 * 0.06,
                    color: tokens.ink3,
                  }}
                >
                  {day.label}
                </Text>
                {day.avg_label ? (
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.accent }}>
                    {day.avg_label}
                  </Text>
                ) : null}
              </View>
              <GlassCard radius={18} contentStyle={{ paddingVertical: 4, paddingHorizontal: 13 }}>
                {day.lessons.map((l, i) => {
                  const sb = getSubject(l.subject_id);
                  return (
                    <View
                      key={`${l.subject_id}-${l.theme}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 10,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: "rgba(23,18,67,0.07)",
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: sb.color,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                          {sb.name.trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                          {l.theme}
                        </Text>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                          {l.homework}
                        </Text>
                      </View>
                      {l.grade === null ? null : (
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 9,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: tokens.chip(tokens.status.green.rgb).bg,
                            borderWidth: 1,
                            borderColor: tokens.chip(tokens.status.green.rgb).border,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.status.green.text }}>
                            {l.grade}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </GlassCard>
            </View>
          ))
        ) : childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={t.more4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : !week || week.days.length === 0 ? (
          <EmptyBlock title={m2.diaryEmptyTitle} text={m2.diaryEmptyText} />
        ) : (
          week.days.map((day) => (
            <View key={day.dateKey} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontFamily: fonts.manrope800,
                    fontSize: 10.5,
                    letterSpacing: 10.5 * 0.08,
                    textTransform: "uppercase",
                    color: tokens.ink3,
                  }}
                >
                  {weekdayDayMonth(day.dateKey, localeTag)}
                </Text>
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                  {day.average != null
                    ? format(m2.diaryDayAvg, { avg: day.average.toFixed(1) })
                    : m2.diaryNoGrade}
                </Text>
              </View>
              <GlassCard radius={18} contentStyle={{ paddingVertical: 2, paddingHorizontal: 12 }}>
                {day.lessons.length === 0 ? (
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2, paddingVertical: 12 }}>
                    {m2.diaryNoLessonsDay}
                  </Text>
                ) : (
                  day.lessons.map((lesson, i) => (
                    <DiaryLessonRow key={lesson.id} lesson={lesson} divider={i > 0} />
                  ))
                )}
              </GlassCard>
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={childId ?? undefined}
          onSelect={(id) => {
            selectChild(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}
