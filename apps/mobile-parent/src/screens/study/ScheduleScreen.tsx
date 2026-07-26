/**
 * Экран #15 «Расписание» — REBUILD 1:1 из макета «SNR EduOS v2 Light.dc.html»,
 * строки 624–647 (block-list Захода 5, порядок строго по макету):
 *  625–630  Header (Back + Title + Calendar + Options — три стеклянных круга 38)
 *  631      Scroll Container (padding 4/18/118, gap 12)
 *  632      Child selector card (compact) — открывает боттом-шит выбора ребёнка
 *  633–638  Week day pills row (7 чипов Пн–Вс) + Calendar button 44×44
 *  639      Schedule banner pill (стеклянная пилюля с датой дня)
 *  640–645  Lessons timeline list — уроки + приглушённые «перемены»
 *
 * Правила заказчика (соблюдены):
 *  – 7-дневная лента Пн–Вс из SCHEDULE_DAYS (не 5).
 *  – Кабинет всегда «Кабинет 101» — SCHEDULE_ROOM_LABEL из фикстуры.
 *  – Чип оценки — ТОЛЬКО у прошедших уроков С оценкой (l.status==='done' && grade!==null).
 *  – «Идёт сейчас» — только у текущего урока (l.status==='live'), оранжевый.
 *  – Перемены рендерятся ОТДЕЛЬНЫМИ приглушёнными строками между уроками (dimmed=true),
 *    заголовок из d.parentApp.grades.break; кружков в списке нет.
 *  – Опозданий НЕТ (соблюдено — статусы посещаемости здесь не показываем per-lesson,
 *    т.к. фикстура ScheduleLessonRow их не содержит).
 *
 * Данные — через аксессоры src/data (getChildren, getSelectedChildContext,
 * getScheduleWeek, getDaySchedule, getSubject). Тексты — через
 * useAppLocale().d.parentApp.*. Обе темы через useTheme(). iOS safe-area — из
 * InnerHeader; скролл имеет paddingBottom 118 под FloatingTabBar.
 *
 * Внутренний вертикальный ScrollView содержит горизонтальный ScrollView с
 * лентой дней — передаём horizontal + nestedScrollEnabled для Android.
 *
 * Заход 2, шаг 4: для реального входа (isRealFlow) неделя/уроки — из
 * public.lessons группы активного ребёнка (packages/core
 * getStudentLessonsForWeek — тот же безопасный FK-hint join
 * teachers!groups_teacher_id_fkey/teachers!subjects_teacher_id_fkey, что
 * фиксил баг «Выходной везде», d9c6baf), ОДИН запрос на видимую календарную
 * неделю (Пн-Вс по Ташкенту). Дни недели — все 7, без «только будни». Ряды
 * урок/перемена для real-флоу строятся в отдельной ветке ("real-lesson")
 * параллельно фикстурной ("lesson") — общий JSX-компонент LessonRow, разный
 * источник полей (subject.name/color/room вместо getSubject()-фикстуры).
 * Демо-флоу — вёрстка и фикстурные данные не тронуты ни строкой.
 */
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getStudentLessonsForWeek, formatTime, LOCALE_TAG, type LessonWithSubject } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassBlur,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  LessonRow,
  glassSurface,
  type ChildPickerItem,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  DEMO_TODAY,
  getChildren,
  getDaySchedule,
  getScheduleWeek,
  getSelectedChildContext,
  getSubject,
} from "../../data";
import type { BaseSubjectKey, ScheduleLessonRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useParentData } from "../../context/ParentDataContext";
import { toChildRow } from "../../lib/realChild";
import { useAsyncData } from "../../hooks/useAsyncData";
import { getSupabase } from "../../lib/supabase";
import { tashkentDateKey, tashkentToday, mondayOfWeek, weekdayIndex, addDays } from "../../lib/tashkent";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** «#ca8a04» → «202,138,4» для tokens.chip()/shadowRgb — тот же локальный
 *  паттерн, что уже в TeacherProfileScreen.tsx/PortfolioScreen.tsx и др. */
function hexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Полное имя дня недели по короткому лейблу SCHEDULE_DAYS (для баннера).
 *  Долги, проход 1: лейблы — из словаря (t.date.*Full), не хардкод; ключи
 *  ("Пн".."Вс") остаются нейтральными внутренними id из фикстуры/реальных
 *  данных, не отображаемым текстом. */
function buildWeekdayFull(date: {
  monFull: string; tueFull: string; wedFull: string; thuFull: string;
  friFull: string; satFull: string; sunFull: string;
}): Record<string, string> {
  return {
    Пн: date.monFull,
    Вт: date.tueFull,
    Ср: date.wedFull,
    Чт: date.thuFull,
    Пт: date.friFull,
    Сб: date.satFull,
    Вс: date.sunFull,
  };
}

/** Иконка календаря (макет строки 628, 637, 639 — тот же путь, разные stroke). */
const CAL_PATHS = [
  "M8 2v4",
  "M16 2v4",
  "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
  "M3 10h18",
];

/** Иконка «три точки» (macros 629, stroke 2.2). */
function DotsIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
      <Rect x={4} y={11} width={2} height={2} rx={1} />
      <Rect x={11} y={11} width={2} height={2} rx={1} />
      <Rect x={18} y={11} width={2} height={2} rx={1} />
    </Svg>
  );
}

/** Иконка календаря 16 (макет 628, header — цвет ink1). */
function CalIcon({ color, size = 16, strokeWidth = 1.8 }: { color: string; size?: number; strokeWidth?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CAL_PATHS.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/** Иконка «календарь с галочкой» для banner-пилюли (макет 639). */
function CalCheckIcon({ color }: { color: string }) {
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CAL_PATHS.map((d, i) => (
        <Path key={i} d={d} />
      ))}
      <Path d="m9.5 15 1.8 1.8 3.4-3.6" />
    </Svg>
  );
}

/** Ячейка ленты дней (макет 635): активная — заливной градиент accent 135°, тень;
 *  неактивная — стеклянная (glass1) со стеклянной каймой. */
function DayPill({
  weekday,
  day,
  active,
  onPress,
}: {
  weekday: string;
  day: number;
  active: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const g = gradPoints(tokens.glass1.angle);

  if (active) {
    // Активная пилюля — заливной градиент accent 135° (макет: pick-стиль).
    return (
      <Pressable onPress={onPress} style={{ borderRadius: 14 }}>
        <View
          style={[
            {
              width: 44,
              paddingVertical: 8,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              gap: 2,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
            },
            shadowStyle(tokens.shColor(tokens.status.violet.rgb)),
          ]}
        >
          <LinearGradient
            colors={tokens.accentGrad.colors as [string, string]}
            {...gradPoints(tokens.accentGrad.angle)}
            style={StyleSheet.absoluteFill}
          />
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 9.5,
              letterSpacing: 0.4,
              color: "rgba(255,255,255,0.85)",
              textTransform: "uppercase",
            }}
          >
            {weekday}
          </Text>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
            {day}
          </Text>
        </View>
      </Pressable>
    );
  }

  // Неактивная пилюля — стеклянная (glass1) с каймой и лёгкой тенью.
  const surface = glassSurface(tokens.glass1, scheme);
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 14 }}>
      <View
        style={{
          width: 44,
          paddingVertical: 8,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          gap: 2,
          borderWidth: 1,
          borderColor: tokens.glassBorder,
        }}
      >
        {surface.mode === "blur" ? (
          <>
            <GlassBlur
              intensity={surface.intensity}
              tint={surface.tint}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={tokens.glass1.colors as [string, string]}
              start={g.start}
              end={g.end}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
        )}
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 9.5,
            letterSpacing: 0.4,
            color: tokens.ink3,
            textTransform: "uppercase",
          }}
        >
          {weekday}
        </Text>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1 }}>
          {day}
        </Text>
      </View>
    </Pressable>
  );
}

/** Стеклянная пилюля-баннер (макет 639): r999, glass1, blur(22), тень s-card. */
function SchedBanner({ text }: { text: string }) {
  const { tokens, scheme } = useTheme();
  const surface = glassSurface(tokens.glass1, scheme);
  const g = gradPoints(tokens.glass1.angle);

  return (
    <View
      style={[
        {
          borderRadius: 999,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          alignSelf: "flex-start",
        },
        shadowStyle(tokens.shCard),
      ]}
    >
      {surface.mode === "blur" ? (
        <>
          <GlassBlur
            intensity={surface.intensity}
            tint={surface.tint}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={tokens.glass1.colors as [string, string]}
            start={g.start}
            end={g.end}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
      )}
      {/* inset-блик стекла — верхняя hairline-полоска. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: tokens.glassInset.y,
          backgroundColor: tokens.glassInset.color,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        <CalCheckIcon color={tokens.accent} />
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export default function ScheduleScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const WEEKDAY_FULL = useMemo(() => buildWeekdayFull(d.parentApp.date), [d.parentApp.date]);
  const navigation = useNavigation<Nav>();

  const session = useAuthSession();
  const { data: parentData, selectedChildId, selectChild } = useParentData();
  const isRealFlow = !session.demoParentId && !!parentData && parentData.children.length > 0;
  const realIndex = isRealFlow
    ? Math.max(0, parentData!.children.findIndex((c) => c.id === selectedChildId))
    : -1;
  const realChildRow = isRealFlow ? toChildRow(parentData!.children[realIndex], realIndex) : null;

  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX].id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const todayKey = useMemo(() => tashkentToday(), []);
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    isRealFlow ? weekdayIndex(todayKey) : DEMO_TODAY.weekday_index,
  );

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  const identityChild = realChildRow ?? child;
  const week = getScheduleWeek();
  const lessons = getDaySchedule(selectedDay, childId);

  // ── Заход 2, шаг 4: реальная неделя (Пн-Вс, содержащая «сегодня» по
  // Ташкенту) — ОДИН запрос getStudentLessonsForWeek на всю неделю, дни
  // переключаются локально (без рефетча на каждый тап по дню).
  const weekStartKey = useMemo(() => mondayOfWeek(todayKey), [todayKey]);
  const realWeekDays = useMemo(() => {
    const dateNs = d.parentApp.date;
    const shortLabels = [dateNs.mon, dateNs.tue, dateNs.wed, dateNs.thu, dateNs.fri, dateNs.sat, dateNs.sun];
    const fullLabels = [dateNs.monFull, dateNs.tueFull, dateNs.wedFull, dateNs.thuFull, dateNs.friFull, dateNs.satFull, dateNs.sunFull];
    return shortLabels.map((weekday_label, i) => {
      const dateKey = addDays(weekStartKey, i);
      return { weekday_label, weekday_full: fullLabels[i], day: Number(dateKey.slice(8, 10)), dateKey };
    });
  }, [weekStartKey, d.parentApp.date]);

  const scheduleState = useAsyncData(
    () =>
      isRealFlow && selectedChildId
        ? getStudentLessonsForWeek(getSupabase(), weekStartKey, selectedChildId)
        : Promise.resolve(null),
    [isRealFlow, selectedChildId, weekStartKey],
  );

  const realLessonsByDate = useMemo(() => {
    const map = new Map<string, LessonWithSubject[]>();
    (scheduleState.data ?? []).forEach((l) => {
      const key = tashkentDateKey(l.starts_at);
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    });
    return map;
  }, [scheduleState.data]);

  const realDayLessons = useMemo(
    () => realLessonsByDate.get(realWeekDays[selectedDay]?.dateKey ?? "") ?? [],
    [realLessonsByDate, realWeekDays, selectedDay],
  );

  // Пункты шторки выбора ребёнка (BottomSheetFrame + ChildPickerSheetContent).
  const pickerItems: ChildPickerItem[] = isRealFlow
    ? parentData!.children.map((c, i) => {
        const row = toChildRow(c, i);
        return {
          id: row.id,
          initials: row.first_name.slice(0, 1),
          gradient: row.avatar_gradient,
          ringColor: row.avatar_ring,
          name: row.full_name,
          classLabel: `${row.class_name} ${d.parentApp.grades.class}`,
          statusLabel: "—",
          statusTone: "gray" as const,
        };
      })
    : children.map((k) => ({
        id: k.id,
        initials: k.first_name.slice(0, 1),
        gradient: k.avatar_gradient,
        ringColor: k.avatar_ring,
        name: k.full_name,
        classLabel: `${k.class_name} ${d.parentApp.grades.class}`,
        statusLabel: k.status_chip,
        statusTone: k.status_chip === "В школе" ? "green" : "gray",
      }));

  // Баннер даты: если выбран текущий день демо — используем label_full напрямую,
  // иначе собираем «Понедельник, 21 июля» из полного имени дня + числа + «июля».
  const schedBanner = useMemo(() => {
    if (selectedDay === DEMO_TODAY.weekday_index) return DEMO_TODAY.label_full;
    const dayRow = week[selectedDay];
    if (!dayRow) return "";
    const full = WEEKDAY_FULL[dayRow.weekday_label] ?? dayRow.weekday_label;
    return `${full}, ${dayRow.day} июля`;
  }, [selectedDay, week]);

  // Реальный баннер даты: та же форма («Сегодня, 21 июля» / «Вторник, 22
  // июля»), но дата — из realWeekDays (реальный календарь), не из фикстуры.
  const realSchedBanner = useMemo(() => {
    const dayRow = realWeekDays[selectedDay];
    if (!dayRow) return "";
    const [y, m, dd] = dayRow.dateKey.split("-").map(Number);
    const dateLabel = new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString(LOCALE_TAG[locale], {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    if (dayRow.dateKey === todayKey) return `${d.parentApp.date.today}, ${dateLabel}`;
    return `${dayRow.weekday_full}, ${dateLabel}`;
  }, [selectedDay, realWeekDays, todayKey, locale, d.parentApp.date]);

  const weekFinal = isRealFlow ? realWeekDays : week;
  const schedBannerFinal = isRealFlow ? realSchedBanner : schedBanner;

  // Собираем строки урок/перемена: между двумя последовательными уроками
  // вставляем строку-перемену starts_at=lesson_i.ends_at, ends_at=lesson_{i+1}.starts_at.
  type Row =
    | { kind: "lesson"; l: ScheduleLessonRow }
    | { kind: "real-lesson"; l: LessonWithSubject }
    | { kind: "break"; start: string; end: string; keyId: string };
  const fixtureRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (let i = 0; i < lessons.length; i++) {
      out.push({ kind: "lesson", l: lessons[i] });
      const next = lessons[i + 1];
      if (next) {
        out.push({
          kind: "break",
          start: lessons[i].ends_at,
          end: next.starts_at,
          keyId: `br-${i}`,
        });
      }
    }
    return out;
  }, [lessons]);

  const realRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (let i = 0; i < realDayLessons.length; i++) {
      out.push({ kind: "real-lesson", l: realDayLessons[i] });
      const cur = realDayLessons[i];
      const next = realDayLessons[i + 1];
      if (next && cur.ends_at) {
        out.push({
          kind: "break",
          start: formatTime(cur.ends_at, LOCALE_TAG[locale]),
          end: formatTime(next.starts_at, LOCALE_TAG[locale]),
          keyId: `br-${i}`,
        });
      }
    }
    return out;
  }, [realDayLessons, locale]);

  const rows = isRealFlow ? realRows : fixtureRows;

  return (
    <AppBackground>
      {/* 1. Header (back / title / calendar / options) — макет 625–630. */}
      <InnerHeader
        title={d.parentApp.scr.schedule}
        onBackPress={() => navigation.goBack()}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <GlassCircleButton onPress={() => navigation.navigate("stub", { stubKey: "datepick" })}>
              <CalIcon color={tokens.ink1} />
            </GlassCircleButton>
            <GlassCircleButton onPress={() => navigation.navigate("stub", { stubKey: "schedopts" })}>
              <DotsIcon color={tokens.ink1} />
            </GlassCircleButton>
          </View>
        }
      />

      {/* 2. Scrollable content area — макет 631 (padding 4 18 118, gap 12). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. Child selector card — макет 632 (compact glass, шеврон-вниз, openSheet). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: identityChild.first_name.slice(0, 1),
            gradient: identityChild.avatar_gradient,
            ringColor: identityChild.avatar_ring,
          }}
          name={identityChild.full_name}
          classLabel={`${identityChild.class_name} ${d.parentApp.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* 4. Week day pills row + Calendar button — макет 633–638. */}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingBottom: 2 }}
            style={{ flex: 1 }}
          >
            {weekFinal.map((dp, i) => (
              <DayPill
                key={`${dp.weekday_label}-${dp.day}`}
                weekday={dp.weekday_label}
                day={dp.day}
                active={i === selectedDay}
                onPress={() => setSelectedDay(i)}
              />
            ))}
          </ScrollView>
          {/* Квадратная стеклянная кнопка календаря 44×44 (макет 637). */}
          <Pressable
            onPress={() => navigation.navigate("stub", { stubKey: "datepick" })}
            style={[
              {
                width: 44,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: tokens.glassBorder,
                backgroundColor: "rgba(255,255,255,0.5)",
                alignItems: "center",
                justifyContent: "center",
              },
              shadowStyle(tokens.shCard),
            ]}
          >
            <CalIcon color={tokens.accent} size={17} strokeWidth={1.9} />
          </Pressable>
        </View>

        {/* 5. Schedule banner pill — макет 639. */}
        {schedBannerFinal ? <SchedBanner text={schedBannerFinal} /> : null}

        {/* 6. Lessons timeline list — макет 640–645 (уроки + перемены отдельными
             приглушёнными строками через тот же цикл). Заход 2, шаг 4: для
             real-флоу — loading/error раздельно (useAsyncData, без .catch),
             «нет уроков в этот день» визуально отличается от ошибки запроса
             (история тихих RLS-пустот — не заминаем сбой пустым списком). */}
        {isRealFlow && scheduleState.loading ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : isRealFlow && scheduleState.error ? (
          <GlassCard
            radius={20}
            contentStyle={{
              padding: 18,
              gap: 10,
              alignItems: "center",
              borderWidth: 1,
              borderColor: `rgba(${tokens.status.red.rgb},0.35)`,
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.red.text, textAlign: "center" }}>
              {d.parentApp.sched.loadError}
            </Text>
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2, textAlign: "center" }}>
              {scheduleState.error.message}
            </Text>
            <Pressable
              onPress={() => scheduleState.refresh()}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: `rgba(${tokens.status.red.rgb},0.14)`,
                borderWidth: 1,
                borderColor: `rgba(${tokens.status.red.rgb},0.4)`,
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.status.red.text }}>
                {d.parentApp.common.retry}
              </Text>
            </Pressable>
          </GlassCard>
        ) : isRealFlow && rows.length === 0 ? (
          <GlassCard radius={20} contentStyle={{ padding: 18, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2, textAlign: "center" }}>
              {d.parentApp.sched.emptyDay}
            </Text>
          </GlassCard>
        ) : (
          rows.map((row) => {
            if (row.kind === "break") {
              // Перемена — приглушённая строка с заголовком «Перемена».
              return (
                <LessonRow
                  key={row.keyId}
                  timeStart={row.start}
                  timeEnd={row.end}
                  title={d.parentApp.grades.break}
                  dimmed
                />
              );
            }
            if (row.kind === "real-lesson") {
              // Реальный урок: предмет/цвет/кабинет/тема — из public.lessons
              // (packages/core getStudentLessonsForWeek), не из фикстуры.
              // Оценка не показываем (нет реального per-lesson join в этом
              // шаге — не изобретаем). onPress не задаём: экран деталей
              // предмета (d11) пока целиком на фикстурах, вести туда с
              // реального урока значило бы показать чужие (фикстурные)
              // данные — сознательно не кликабельно, до появления реального
              // экрана деталей.
              const l = row.l;
              const subjColor = l.subject?.color ?? tokens.ink3;
              const dotHalo = l.subject?.color ? tokens.chip(hexToRgbCsv(l.subject.color)).bg : undefined;
              const nowLabel = l.status === "in_progress" ? d.parentApp.status.liveNow : undefined;
              return (
                <LessonRow
                  key={`rl-${l.id}`}
                  timeStart={formatTime(l.starts_at, LOCALE_TAG[locale])}
                  timeEnd={l.ends_at ? formatTime(l.ends_at, LOCALE_TAG[locale]) : undefined}
                  active={l.status === "in_progress"}
                  dotColor={subjColor}
                  dotHalo={dotHalo}
                  barGradient={l.subject?.color ? [l.subject.color, l.subject.color] : undefined}
                  title={l.subject?.name ?? l.title ?? "—"}
                  subtitle={l.room ? `${d.parentApp.sched.room} ${l.room}` : "—"}
                  themeLine={l.topic ? `${d.parentApp.grades.topic} ${l.topic}` : undefined}
                  nowLabel={nowLabel}
                  dimmed={l.status === "completed"}
                />
              );
            }
            const l = row.l;
            const subject = getSubject(l.subject_id);
            // Точка-маркер в колонке времени — цвет base предмета; ореол — chip-цвет.
            const subjTokenKey =
              l.subject_id === "rusF" ? "rus" : (l.subject_id as BaseSubjectKey);
            const subjToken = tokens.subjects[subjTokenKey as keyof typeof tokens.subjects];
            const dotColor = subjToken?.base ?? subject.color;
            const dotHalo = subject.chip_bg;
            // Чип оценки — ТОЛЬКО у прошедших с выставленной оценкой.
            const showGrade = l.status === "done" && l.grade != null;
            const gradeChip = showGrade
              ? {
                  value: String(l.grade),
                  text: tokens.status.green.text,
                  rgb: tokens.status.green.rgb,
                }
              : undefined;
            const nowLabel = l.status === "live" ? d.parentApp.status.liveNow : undefined;
            return (
              <LessonRow
                key={`l-${l.slot_index}`}
                timeStart={l.starts_at}
                timeEnd={l.ends_at}
                active={l.status === "live"}
                dotColor={dotColor}
                dotHalo={dotHalo}
                barGradient={subject.gradient}
                title={subject.name}
                subtitle={`${l.room_label}`}
                themeLine={`${d.parentApp.grades.topic} ${subject.current_topic}`}
                grade={gradeChip}
                nowLabel={nowLabel}
                dimmed={l.status === "done" && !showGrade}
                onPress={() => navigation.navigate("d11")}
              />
            );
          })
        )}
      </ScrollView>

      {/* Шторка выбора ребёнка (BottomSheetFrame + ChildPickerSheetContent). */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={d.parentApp.auth.chooseChild}
          items={pickerItems}
          selectedId={isRealFlow ? (selectedChildId ?? undefined) : childId}
          onSelect={(id) => {
            if (isRealFlow) {
              selectChild(id);
            } else {
              setChildId(id);
            }
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}
