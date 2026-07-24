/**
 * d6 «Статус дня» — Заход 5, пересборка block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 413–454.
 *
 * Порядок блоков (сверху вниз, дословно из block-list):
 *  1. HeaderBar               (строки 414–419): back-glass 38, title «Статус дня» +
 *                             подпись даты (dsLbl6), два круглых glass-действия
 *                             goDatepick / goSched.
 *  2. ScrollContainer         (строка 420): flex:1, gap 12, padding 4/18/118/18.
 *  3. ChildSwitcherCard       (строка 421): glass compact-row, аватар 44 + ФИО +
 *                             «7-А класс» + шеврон-вниз, справа зелёный чип
 *                             «В школе» (без хвостового шеврона).
 *  4. InSchoolBanner          (строки 422–425): AccentCard green→cyan, шилд 42
 *                             в стеклянной вставке, «Малика в школе» + «Пришл{suf}
 *                             в 08:12 · главный вход», шеврон вправо.
 *  5. AttendanceSectionHeader (строка 426): caps «ПОСЕЩАЕМОСТЬ» + «Смотреть все ›».
 *  6. AttendanceDonutCard     (строки 427–433): SVG donut 86 (dasharray 67 201),
 *                             3 легенды (Присутствовал / Уважительная / Без
 *                             уважительной), progress-hint.
 *  7. ScheduleSectionHeader   (строка 434): caps «РАСПИСАНИЕ СЕГОДНЯ».
 *  8. TodayScheduleCard       (строки 435–442): единая glass-карточка со списком
 *                             уроков; каждая строка — время / цветная полоска /
 *                             название / «Кабинет 101» / статус-маркер:
 *                             done → зелёный круг 20 с галочкой,
 *                             live → чип «Идёт сейчас» (orange),
 *                             next → серая точка 8.
 *  9. MealsSectionHeader      (строка 443): caps «ПИТАНИЕ».
 *  10. MealsCard              (строки 444–448): glass-row, иконка «вилка+ложка»
 *                             52 mint/cyan, «Меню: стандартное», «Обед в 12:40 ·
 *                             столовая», зелёная строка баланса.
 *
 * Данные — через аксессоры (getDayStatus + getChildren + getSubject) и
 * фикстуру DEMO_TODAY. Тексты — d.parentApp.* (RU/UZ/EN). Обе темы — useTheme().
 * iOS safe-area у шапки. НЕТ «опозданий», НЕТ «кружков» (правила заказчика).
 */
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Text as SvgTextEl } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassBlur,
  GlassCard,
  GlassCircleButton,
  type ChildPickerItem,
} from "../../ui";
import {
  DEMO_TODAY,
  getChildren,
  getDayStatus,
  getSelectedChildContext,
  getSubject,
} from "../../data";
import type { SubjectKey } from "../../data";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import { formatMoney } from "../../lib/format";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Иконка календарь с точкой (goDatepick, строка 417). */
const CAL_DOT_PATHS = [
  "M8 2v4",
  "M16 2v4",
  "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
  "M3 10h18",
  "M12 15h.01",
];
/** Иконка календарь-сетка (goSched, строка 418). */
const CAL_GRID_PATHS = [
  "M8 2v4",
  "M16 2v4",
  "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
  "M3 10h18",
];
/** Щит с галочкой (InSchoolBanner, строка 423). */
const SHIELD_CHECK_PATHS = [
  "M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z",
  "m9 12 2 2 4-4",
];
/** Иконка «вилка + ложка» — приборы (MealsCard, строка 445). */
const CUTLERY_PATHS = [
  "M4 2v7a3 3 0 0 0 6 0V2",
  "M7 12v10",
  "M20 2a4 4 0 0 0-4 4v7h4",
  "M20 13v9",
];

/** Круглая стеклянная кнопка 38 в шапке с произвольным глифом. */
function HeaderIconButton({
  paths,
  size = 16,
  onPress,
  strokeColor,
}: {
  paths: string[];
  size?: number;
  onPress?: () => void;
  strokeColor: string;
}) {
  return (
    <GlassCircleButton onPress={onPress}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </Svg>
    </GlassCircleButton>
  );
}

/** Стрелка «назад» 18 stroke 2 (строка 415). */
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="m12 19-7-7 7-7" />
    </Svg>
  );
}

/** Шеврон вправо (шевроны в баннере и meals-строке). */
function ChevronRight({ size = 15, color, strokeWidth = 2.2 }: { size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Донат посещаемости 86×86, viewBox 88×88, dasharray 67 201 (строка 428). */
function AttendanceDonut({
  presentCount,
  totalCount,
  unitLabel,
  ringDim,
  ringInk,
  ringMuted,
}: {
  presentCount: number;
  totalCount: number;
  unitLabel: string;
  ringDim: string;
  ringInk: string;
  ringMuted: string;
}) {
  const r = 32;
  const c = 2 * Math.PI * r; // ≈ 201
  const progress = totalCount > 0 ? (presentCount / totalCount) * c : 0;
  const dashArray = `${progress} ${c - progress}`;
  return (
    <Svg width={86} height={86} viewBox="0 0 88 88">
      <Circle cx={44} cy={44} r={r} fill="none" stroke={ringDim} strokeWidth={10} />
      <Circle
        cx={44}
        cy={44}
        r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        transform="rotate(-90 44 44)"
      />
      {/* Текст центра — через <text> react-native-svg. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <SvgText x={44} y={42} anchor="middle" size={16} weight="800" color={ringInk}>
        {`${presentCount}/${totalCount}`}
      </SvgText>
      <SvgText x={44} y={56} anchor="middle" size={8.5} weight="700" color={ringMuted}>
        {unitLabel}
      </SvgText>
    </Svg>
  );
}

/** Тонкий wrapper над <Text> из react-native-svg — единый стиль подписей в SVG. */
function SvgText({
  x,
  y,
  anchor,
  size,
  weight,
  color,
  children,
}: {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  size: number;
  weight: "600" | "700" | "800";
  color: string;
  children: string;
}) {
  return (
    <SvgTextEl
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fill={color}
      fontFamily={weight === "800" ? fonts.manrope800 : weight === "700" ? fonts.manrope700 : fonts.manrope600}
    >
      {children}
    </SvgTextEl>
  );
}

/** Легенда доната (квадрат 9 + подпись + число). */
function DonutLegend({
  color,
  label,
  count,
  labelColor,
  countColor,
}: {
  color: string;
  label: string;
  count: number;
  labelColor: string;
  countColor: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11, color: labelColor }}>
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: countColor }}>
        {count}
      </Text>
    </View>
  );
}

/** Аватар-инициал 44 (childAvStyle44) — простой круг с градиентом и белым текстом. */
function ChildAvatar44({ initial, gradient }: { initial: string; gradient: [string, string] }) {
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LinearGradient colors={gradient} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 16, color: "#FFFFFF" }}>
        {initial}
      </Text>
    </View>
  );
}

export default function DayStatusScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const auth = useAuthSession();

  // Активный ребёнок: из auth-сессии либо дефолт из фикстур.
  const children = getChildren();
  const initialChildId = auth.currentChildId ?? getSelectedChildContext().child.id;
  const [childId, setChildId] = useState<string>(initialChildId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const ds = getDayStatus(childId);
  const child = ds.child;
  const lessons = ds.lessons;

  const dateLabel = DEMO_TODAY.label_full;

  // Донат посещаемости — правила заказчика: 3 категории, БЕЗ «опозданий».
  const presentCount = ds.lessons_attended;
  const totalCount = ds.lessons_total;
  const excusedCount = 0;
  const unexcusedCount = 0;

  // Полупрозрачные цвета для донута/линий/подписей — обе темы.
  const ringDim = scheme === "light" ? "rgba(23,18,67,0.09)" : "rgba(255,255,255,0.12)";
  const rowDivider = scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)";
  const timeInk = tokens.ink2;
  const timeInkStrong = tokens.ink1;
  const legendLabelColor = scheme === "light" ? "rgba(26,19,74,0.74)" : "rgba(255,255,255,0.72)";
  const legendCountColor = tokens.ink1;
  const progressHintColor = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const capsColor = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const linkColor = scheme === "light" ? "#6D28D9" : "#C4B5FD";
  const headerSubColor = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.6)";
  const roomMutedColor = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.55)";
  const mealsSubColor = scheme === "light" ? "rgba(26,19,74,0.62)" : "rgba(255,255,255,0.6)";
  const chevronMuted = scheme === "light" ? "rgba(26,19,74,0.4)" : "rgba(255,255,255,0.42)";

  const green = tokens.status.green;
  const orange = tokens.status.orange;

  // Иконка колокольчика/back-стрелки — по теме (макет: #171243 → #fff).
  const iconStroke = tokens.ink1;

  const pickerItems: ChildPickerItem[] = children.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${d.parentApp.grades.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  // ─── Расписание сегодня ────────────────────────────────────────────────────
  // Строим строки с полосой-акцентом по subject_id → SUBJECTS[key].gradient.
  return (
    <AppBackground>
      {/* 1. HeaderBar. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => navigation.goBack()}>
          <BackArrow color={iconStroke} />
        </GlassCircleButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.unbounded600,
              fontSize: 15,
              color: tokens.ink1,
            }}
          >
            {d.parentApp.scr.dayStatus}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 10.5,
              color: headerSubColor,
            }}
          >
            {dateLabel}
          </Text>
        </View>
        <HeaderIconButton
          paths={CAL_DOT_PATHS}
          size={16}
          strokeColor={iconStroke}
          onPress={() => navigation.navigate("stub", { stubKey: "datepick" })}
        />
        <HeaderIconButton
          paths={CAL_GRID_PATHS}
          size={16}
          strokeColor={iconStroke}
          onPress={() => navigation.navigate("d15")}
        />
      </View>

      {/* 2. ScrollContainer. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. ChildSwitcherCard (compact, без switchLabel). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          status={{ label: child.status_chip, tone: "green" }}
          onPress={() => setSheetOpen(true)}
        />

        {/* 4. InSchoolBanner. */}
        <AccentCard
          gradient={["#34d399", "#0ea5e9"]}
          angle={135}
          shadowRgb="14,165,233"
          radius={20}
          contentStyle={{
            padding: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
          onPress={() => setSheetOpen(true)}
        >
          {/* Шилд 42 в стеклянной вставке (rgba W20 + border W40 + blur 8). */}
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GlassBlur intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <Svg
              width={19}
              height={19}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {SHIELD_CHECK_PATHS.map((dpath, i) => (
                <Path key={i} d={dpath} />
              ))}
            </Svg>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 14.5,
                color: "#FFFFFF",
              }}
            >
              {`${child.first_name}${ds.banner_title_suffix}`}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 11,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {ds.banner_sub}
            </Text>
          </View>
          <ChevronRight color="rgba(255,255,255,0.8)" />
        </AccentCard>

        {/* 5. AttendanceSectionHeader. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10.5,
              letterSpacing: 0.84,
              textTransform: "uppercase",
              color: capsColor,
            }}
          >
            {d.parentApp.scr.attendance}
          </Text>
          <Pressable onPress={() => navigation.navigate("d14")} hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11.5,
                color: linkColor,
              }}
            >
              {`${d.parentApp.common.viewAll} ›`}
            </Text>
          </Pressable>
        </View>

        {/* 6. AttendanceDonutCard. */}
        <GlassCard
          radius={20}
          contentStyle={{
            padding: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <AttendanceDonut
            presentCount={presentCount}
            totalCount={totalCount}
            unitLabel="уроков"
            ringDim={ringDim}
            ringInk={tokens.ink1}
            ringMuted={scheme === "light" ? "rgba(26,19,74,0.55)" : "rgba(255,255,255,0.6)"}
          />
          <View style={{ flex: 1, gap: 7 }}>
            <DonutLegend
              color="#10b981"
              label="Присутствовал"
              count={presentCount}
              labelColor={legendLabelColor}
              countColor={legendCountColor}
            />
            <DonutLegend
              color="#f97316"
              label="Уважительная причина"
              count={excusedCount}
              labelColor={legendLabelColor}
              countColor={legendCountColor}
            />
            <DonutLegend
              color="#ef4444"
              label="Без уважительной"
              count={unexcusedCount}
              labelColor={legendLabelColor}
              countColor={legendCountColor}
            />
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 10,
                color: progressHintColor,
              }}
            >
              {ds.ring_note}
            </Text>
          </View>
        </GlassCard>

        {/* 7. ScheduleSectionHeader. */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 0.84,
            textTransform: "uppercase",
            color: capsColor,
          }}
        >
          {d.parentApp.sched.today}
        </Text>

        {/* 8. TodayScheduleCard. */}
        <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 5 }}>
          {lessons.map((lesson, idx) => {
            const subj = getSubject(lesson.subject_id as SubjectKey);
            const isFirst = idx === 0;
            const isLive = lesson.status === "live";
            const isDone = lesson.status === "done";
            return (
              <Pressable
                key={`${lesson.slot_index}-${lesson.subject_id}`}
                onPress={() => navigation.navigate("d15")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 9,
                  borderTopWidth: isFirst ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: rowDivider,
                }}
              >
                {/* Время. У «идёт сейчас» — контрастный ink1, иначе ink2. */}
                <Text
                  style={{
                    width: 40,
                    fontFamily: fonts.manrope800,
                    fontSize: 11,
                    color: isLive ? timeInkStrong : timeInk,
                  }}
                >
                  {lesson.starts_at}
                </Text>
                {/* Цветная вертикальная полоска-акцент по предмету. */}
                <View style={{ width: 3.5, height: 26, borderRadius: 2, overflow: "hidden" }}>
                  <LinearGradient
                    colors={subj.gradient}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 12,
                      color: tokens.ink1,
                    }}
                  >
                    {subj.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.manrope600,
                      fontSize: 9.5,
                      color: roomMutedColor,
                    }}
                  >
                    {lesson.room_label}
                  </Text>
                </View>
                {/* Правый маркер статуса: done | live | next. */}
                {isDone ? (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: `rgba(${green.rgb},0.16)`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Svg
                      width={11}
                      height={11}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={green.text}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M20 6 9 17l-5-5" />
                    </Svg>
                  </View>
                ) : isLive ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: `rgba(${orange.rgb},0.14)`,
                      borderWidth: 1,
                      borderColor: `rgba(${orange.rgb},0.35)`,
                    }}
                  >
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: `rgb(${orange.rgb})`,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 9,
                        color: orange.text,
                      }}
                    >
                      {d.parentApp.status.liveNow}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        scheme === "light"
                          ? "rgba(23,18,67,0.18)"
                          : "rgba(255,255,255,0.2)",
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </GlassCard>

        {/* 9. MealsSectionHeader. */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 0.84,
            textTransform: "uppercase",
            color: capsColor,
          }}
        >
          {d.parentApp.svc.meals}
        </Text>

        {/* 10. MealsCard. */}
        <GlassCard
          radius={20}
          contentStyle={{
            padding: 12,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
          onPress={() => navigation.navigate("dmeals")}
        >
          {/* Иконка вилка+ложка 52 mint/cyan (rgba(52,211,153,.28)→rgba(14,165,233,.28)). */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.8)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LinearGradient
              colors={["rgba(52,211,153,0.28)", "rgba(14,165,233,0.28)"]}
              {...gradPoints(135)}
              style={StyleSheet.absoluteFill}
            />
            <Svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke={green.text}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {CUTLERY_PATHS.map((dpath, i) => (
                <Path key={i} d={dpath} />
              ))}
            </Svg>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12.5,
                color: tokens.ink1,
              }}
            >
              {ds.meals_menu_label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 10.5,
                color: mealsSubColor,
              }}
            >
              {ds.meals_time_label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                color: green.text,
              }}
            >
              {`Баланс питания: ${formatMoney(ds.meals_balance)} ${d.parentApp.pay.sum}`}
            </Text>
          </View>
          <ChevronRight size={14} color={chevronMuted} />
        </GlassCard>
      </ScrollView>

      {/* Шторка выбора ребёнка (openSheet). */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={d.parentApp.auth.chooseChild}
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
