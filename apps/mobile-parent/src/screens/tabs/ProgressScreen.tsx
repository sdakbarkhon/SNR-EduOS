/**
 * П10 «Успехи» — заход 4.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 273–374:
 *  274–279 шапка (RootHeader без лого, заголовок nav.grades 17/600),
 *  281 ChildSwitcherCard compact со «Сменить ребёнка ›»,
 *  282–289 AccentCard «Средний балл» + inset-tile «Прогресс за неделю»
 *   (Sparkline 56×20, viewBox 64×24) и «Посещаемость» (линейная 4px + текст),
 *  290 SegmentPills 3 таба «Оценки / Навыки / Динамика»,
 *  ветка isGrades: 294 period-popover + delta, 305–312 grid 3×2 SubjectTile,
 *    313–319 5 строк ProgressBar-list, 320–325 «Сильные / зоны роста» с chip,
 *    326 SectionHeader Reviews + 327–331 карточка отзыва,
 *    332–336 AccentCard Assistant;
 *  ветка isSkills: 342 header + 343–348 4 плитки-навыков (24×24 icon + %
 *    + ProgressBar 3.5px), 349–353 GlassCard «Профиль навыков» (Radar 200×172)
 *    + 4 chip-навыка, 354 AccentCard Assistant;
 *  ветка isDyn: 360–364 Sparkline 320×90 с endDot + месяцы, 365–369 3 строки,
 *    370 note.
 *
 * Данные — через аксессоры src/data. Тексты — через useAppLocale().d.parentApp.*.
 * Обе темы через useTheme(); iOS safe-area — из RootHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  AccentInset,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  Popover,
  ProgressBar,
  Radar,
  RootHeader,
  SectionHeader,
  SegmentPills,
  Sparkline,
  StarRating,
  SubjectTile,
  type ChildPickerItem,
  type SubjectId,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  getAssistantTexts,
  getChildren,
  getGradePeriods,
  getGradesAssistantNotes,
  getGradesSummary,
  getSelectedChildContext,
  getSkillsTab,
  getSubject,
  getSubjectStats,
  getTeacherReviews,
  getUnreadNotificationsCount,
} from "../../data";
import type { BaseSubjectKey, SubjectStatRow } from "../../data";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Глиф предмета (макет: prog «< >», math «√x», eng «Aa», rus «Aa», robo — SVG). */
const SUBJECT_GLYPH: Record<BaseSubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** Icon-glyph SVG (звёздочка `#f59e0b` рядом с оценкой, макет строка 306). */
function StarGlyph({ size = 12, color = "#F59E0B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
    </Svg>
  );
}

/** Chevron > для sub-tile «Посещаемость». */
function ChevronRight({ size = 9, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Uppercase caps-лейбл 9/800, letter-spacing .08em, полупрозрачно-белый. */
function AccentCapsLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 9,
        letterSpacing: 9 * 0.08,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {children}
    </Text>
  );
}

/** SubjectGridTile — плитка предмета в grid 3×2 (макет 306–312). */
function SubjectGridTile({
  stat,
  onPress,
  subjectName,
}: {
  stat: SubjectStatRow;
  subjectName: string;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: "31%",
        flexGrow: 1,
        alignItems: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.glassBorder,
        backgroundColor: "rgba(255,255,255,0.4)",
      }}
    >
      <SubjectTile subjectId={stat.subject_id as SubjectId} size={34} radius={11} glyph={SUBJECT_GLYPH[stat.subject_id]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
          {stat.grade_label}
        </Text>
        <StarGlyph size={11} />
      </View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.manrope700, fontSize: 8.5, color: tokens.ink2, textAlign: "center" }}
      >
        {subjectName}
      </Text>
    </Pressable>
  );
}

/** Chip-«pill»: маленький бордерный chip с текстом (сильные / зоны роста). */
function ToneChip({ label, tone }: { label: string; tone: "green" | "red" }) {
  const { tokens } = useTheme();
  const st = tokens.status[tone];
  const chip = tokens.chip(st.rgb);
  return (
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: chip.bg,
        borderWidth: 1,
        borderColor: chip.border,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: st.text }}>{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX].id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 grades, 1 skills, 2 dyn

  const periods = getGradePeriods();
  const [period, setPeriod] = useState<string>(periods.default_period);
  const [periodOpen, setPeriodOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  const summary = getGradesSummary();
  const stats = getSubjectStats();
  const skills = getSkillsTab();
  const notes = getGradesAssistantNotes();
  const reviews = getTeacherReviews();
  const bellCount = getUnreadNotificationsCount();

  // Sparkline данные для карточки «Средний балл» — точки макета строка 286
  // «2,19 14,16 26,17 38,10 50,12 62,4»: значения = 24 − y (viewBox 64×24),
  // так шаг «выше — больше» сохраняется.
  const weekSparklineValues = useMemo(
    () =>
      summary.sparkline_points.split(" ").map((p) => {
        const y = parseFloat(p.split(",")[1] ?? "0");
        return 24 - y;
      }),
    [summary.sparkline_points],
  );

  // То же для вкладки «Динамика» (строка 362, viewBox 320×90).
  const dynSparklineValues = useMemo(
    () =>
      summary.dynamics_points.split(" ").map((p) => {
        const y = parseFloat(p.split(",")[1] ?? "0");
        return 90 - y;
      }),
    [summary.dynamics_points],
  );

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

  const parentInitials = "ДК";
  const parentGradient: [string, string] = ["#8b5cf6", "#22d3ee"];

  return (
    <AppBackground>
      <RootHeader
        title={d.parentApp.nav.grades}
        titleSize={17}
        showLogo
        bellCount={bellCount}
        onBellPress={() => navigation.navigate("d8")}
        avatar={{ initials: parentInitials, gradient: parentGradient, variant: "ring" }}
        onAvatarPress={() => navigation.navigate("dhub")}
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
        {/* Compact ChildSwitcherCard (281). */}
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
          switchLabel={`${d.parentApp.prof.switchChild} ›`}
          onPress={() => setSheetOpen(true)}
        />

        {/* AccentCard «Средний балл» (282–289). */}
        <AccentCard
          gradient={["#f97316", "#ec4899"]}
          shadowRgb="249,115,22"
          radius={22}
          contentStyle={{ padding: 16, gap: 12 }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <AccentCapsLabel>{d.parentApp.grades.average}</AccentCapsLabel>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <Text style={{ fontFamily: fonts.unbounded600, fontSize: 34, color: "#FFFFFF" }}>
                  {summary.average_label}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.85)",
                    marginBottom: 6,
                  }}
                >
                  /{summary.average_max_label}
                </Text>
              </View>
              <StarRating count={summary.stars_filled} size={14} />
            </View>
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: "#FFFFFF" }}>
                {summary.average_chip}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <AccentInset radius={14} style={{ flex: 1, padding: 12, gap: 6 }}>
              <AccentCapsLabel>{`Прогресс за неделю`}</AccentCapsLabel>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                  {summary.week_progress_label}
                </Text>
                <Sparkline
                  values={weekSparklineValues}
                  width={56}
                  height={20}
                  strokeColor="#FFFFFF"
                  strokeWidth={2.2}
                />
              </View>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: "rgba(255,255,255,0.85)" }}>
                {summary.week_progress_note}
              </Text>
            </AccentInset>
            <AccentInset
              radius={14}
              style={{ flex: 1, padding: 12, gap: 6 }}
              onPress={() => navigation.navigate("d14")}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AccentCapsLabel>{d.parentApp.scr.attendance}</AccentCapsLabel>
                <ChevronRight />
              </View>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                {summary.attendance_pct}%
              </Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${summary.attendance_pct}%`,
                    backgroundColor: "#FFFFFF",
                  }}
                />
              </View>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: "rgba(255,255,255,0.85)" }}>
                присутствий {summary.attendance_ratio_label}
              </Text>
            </AccentInset>
          </View>
        </AccentCard>

        {/* SegmentPills 3 таба (290). */}
        <SegmentPills
          items={[d.parentApp.grades.tabGrades, d.parentApp.grades.tabSkills, d.parentApp.grades.tabDyn]}
          activeIndex={activeTab}
          onChange={setActiveTab}
        />

        {/* Ветка «Оценки». */}
        {activeTab === 0 && (
          <>
            {/* Период + delta (294–304). */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ position: "relative" }}>
                <Pressable
                  onPress={() => setPeriodOpen((v) => !v)}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: tokens.glassBorder,
                    backgroundColor: "rgba(255,255,255,0.6)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
                    {period}
                  </Text>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="m6 9 6 6 6-6"
                      stroke={tokens.ink1}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
                <Popover visible={periodOpen} width={170}>
                  <View style={{ paddingVertical: 4 }}>
                    {periods.periods.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => {
                          setPeriod(p);
                          setPeriodOpen(false);
                        }}
                        style={{ paddingVertical: 9, paddingHorizontal: 14 }}
                      >
                        <Text
                          style={{
                            fontFamily: p === period ? fonts.manrope800 : fonts.manrope700,
                            fontSize: 12,
                            color: p === period ? tokens.accent : tokens.ink1,
                          }}
                        >
                          {p}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Popover>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.status.green.text }}>
                  {summary.vs_prev_month_note} ↗
                </Text>
              </View>
            </View>

            {/* Subjects grid (305–312). */}
            <SectionHeader
              title={d.parentApp.grades.subjects}
              linkLabel={`${d.parentApp.scr.allSubjects} ›`}
              onPress={() => navigation.navigate("dallsubj")}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {stats.map((s) => (
                <SubjectGridTile
                  key={s.subject_id}
                  stat={s}
                  subjectName={getSubject(s.subject_id).name}
                  onPress={() => navigation.navigate("d11")}
                />
              ))}
            </View>

            {/* Progress-list (313–319). */}
            <GlassCard radius={22} contentStyle={{ padding: 14, gap: 12 }}>
              {stats.map((s) => {
                const subject = getSubject(s.subject_id);
                const isDown = !s.is_up;
                return (
                  <Pressable
                    key={s.subject_id}
                    onPress={() => navigation.navigate("d11")}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    <SubjectTile
                      subjectId={s.subject_id as SubjectId}
                      size={28}
                      radius={9}
                      glyph={SUBJECT_GLYPH[s.subject_id]}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        width: 96,
                        fontFamily: fonts.manrope800,
                        fontSize: 11,
                        color: tokens.ink1,
                      }}
                    >
                      {subject.name}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar
                        pct={s.pct / 100}
                        height={5.5}
                        fillGradient={subject.gradient}
                      />
                    </View>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
                      {s.grade_label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 10,
                        color: isDown ? tokens.status.red.text : tokens.status.green.text,
                        minWidth: 32,
                        textAlign: "right",
                      }}
                    >
                      {s.delta_label}
                    </Text>
                  </Pressable>
                );
              })}
            </GlassCard>

            {/* «Сильные / зоны роста» (320–325). */}
            <GlassCard radius={22} contentStyle={{ padding: 14, gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  letterSpacing: 10 * 0.08,
                  textTransform: "uppercase",
                  color: tokens.status.green.text,
                }}
              >
                Сильные стороны
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {summary.strengths.map((s) => (
                  <ToneChip key={s} label={s} tone="green" />
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: "rgba(23,18,67,0.08)" }} />
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  letterSpacing: 10 * 0.08,
                  textTransform: "uppercase",
                  color: tokens.status.red.text,
                }}
              >
                Зоны роста
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {summary.growth_areas.map((s) => (
                  <ToneChip key={s} label={s} tone="red" />
                ))}
              </View>
            </GlassCard>

            {/* Отзыв учителя (326–331). */}
            <SectionHeader
              title={d.parentApp.grades.lastReviews}
              linkLabel={`${d.parentApp.common.viewAll} ›`}
              onPress={() => navigation.navigate("drev")}
            />
            <GlassCard radius={22} contentStyle={{ padding: 14, flexDirection: "row", gap: 10 }}>
              <View style={{ position: "relative", width: 38, height: 38 }}>
                <LinearGradient
                  colors={["#8b5cf6", "#6366f1"]}
                  {...gradPoints(135)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                    ГЮ
                  </Text>
                </LinearGradient>
                <View
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#22C55E",
                    borderWidth: 2,
                    borderColor: "#FFFFFF",
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                    {reviews[0].teacher_name} · {getSubject(reviews[0].subject_id).name}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink2 }}>
                    {reviews[0].time_label}
                  </Text>
                </View>
                <Text
                  numberOfLines={3}
                  style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 11 * 1.5, color: tokens.ink2 }}
                >
                  {getAssistantTexts(childId).review}
                </Text>
              </View>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  backgroundColor: `rgba(${tokens.status.green.rgb},0.14)`,
                  borderWidth: 1,
                  borderColor: `rgba(${tokens.status.green.rgb},0.35)`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 22V11m0 0h10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-3l1 4a2 2 0 1 1-4 0v-1H7Z"
                    stroke={tokens.status.green.text}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </GlassCard>

            {/* Assistant CTA (332–336). */}
            <AccentCard
              gradient={["#8b5cf6", "#6366f1"]}
              shadowRgb="139,92,246"
              radius={20}
              contentStyle={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
              onPress={() => navigation.navigate("d7")}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.35)",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9}>
                  <Path
                    d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                  EduOS Assistant
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                  {notes.grades}
                </Text>
              </View>
              <ChevronRight />
            </AccentCard>
          </>
        )}

        {/* Ветка «Навыки». */}
        {activeTab === 1 && (
          <>
            <SectionHeader
              title={d.parentApp.skills.progress}
              linkLabel={`${d.parentApp.common.more} ›`}
              onPress={() => navigation.navigate("d16")}
            />
            {/* Grid 4×1 плитками навыков (макет строки 343–355) — одна строка,
                iconTile 24×24, шрифт названия 9.5px, % 12px. */}
            <View style={{ flexDirection: "row", flexWrap: "nowrap", gap: 6 }}>
              {skills.tiles.map((t) => (
                <View
                  key={t.name}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.glassBorder,
                    backgroundColor: "rgba(255,255,255,0.4)",
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <LinearGradient
                      colors={t.gradient}
                      {...gradPoints(135)}
                      style={{ width: 24, height: 24, borderRadius: 8 }}
                    />
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                      {t.pct}%
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink2 }}
                  >
                    {t.name}
                  </Text>
                  <ProgressBar
                    pct={t.pct / 100}
                    height={3.5}
                    fillGradient={t.gradient}
                  />
                </View>
              ))}
            </View>

            {/* Профиль навыков — Radar. */}
            <GlassCard radius={22} contentStyle={{ padding: 14, gap: 10, alignItems: "center" }}>
              <View style={{ alignSelf: "stretch" }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 10,
                    letterSpacing: 10 * 0.08,
                    textTransform: "uppercase",
                    color: tokens.ink3,
                  }}
                >
                  {d.parentApp.skills.profile}
                </Text>
              </View>
              <Radar
                values={
                  skills.radar_values as unknown as [number, number, number, number, number, number]
                }
                max={100}
                size={200}
                fillColor={`rgba(${tokens.status.violet.rgb},0.28)`}
                strokeColor={tokens.accent}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {skills.chips.map((c) => {
                  const st = tokens.status[c.tone];
                  const chip = tokens.chip(st.rgb);
                  return (
                    <View
                      key={c.name}
                      style={{
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: chip.bg,
                        borderWidth: 1,
                        borderColor: chip.border,
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: st.text }}>
                        {c.name}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: st.text }}>
                        {c.value_label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>

            <AccentCard
              gradient={["#8b5cf6", "#6366f1"]}
              shadowRgb="139,92,246"
              radius={20}
              contentStyle={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
              onPress={() => navigation.navigate("d7")}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.35)",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9}>
                  <Path
                    d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                  EduOS Assistant
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                  {notes.skills}
                </Text>
              </View>
              <ChevronRight />
            </AccentCard>
          </>
        )}

        {/* Ветка «Динамика». */}
        {activeTab === 2 && (
          <>
            <GlassCard radius={22} contentStyle={{ padding: 14, gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  letterSpacing: 10 * 0.08,
                  textTransform: "uppercase",
                  color: tokens.ink3,
                }}
              >
                {d.parentApp.grades.dynAvg}
              </Text>
              <Sparkline
                values={dynSparklineValues}
                width={320}
                height={90}
                strokeColor={tokens.accent}
                strokeWidth={3}
                endDot
                endDotRadius={4.5}
                preserveAspectRatio="none"
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {["фев", "мар", "апр", "май", "июн", "июл"].map((m) => (
                  <Text
                    key={m}
                    style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink3 }}
                  >
                    {m}
                  </Text>
                ))}
              </View>
            </GlassCard>

            <GlassCard radius={22} contentStyle={{ padding: 14 }}>
              {summary.dynamics_months.map((m, i) => {
                const isCurrent = i === summary.dynamics_months.length - 1;
                return (
                  <View
                    key={m.month_label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: "rgba(23,18,67,0.07)",
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: isCurrent ? fonts.manrope800 : fonts.manrope700,
                        fontSize: 12,
                        color: tokens.ink1,
                      }}
                    >
                      {m.month_label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: isCurrent ? fonts.manrope800 : fonts.manrope700,
                        fontSize: 12,
                        color: tokens.ink1,
                        marginRight: 12,
                      }}
                    >
                      {m.avg_label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 11,
                        color: tokens.status.green.text,
                      }}
                    >
                      {m.delta_label}
                    </Text>
                  </View>
                );
              })}
            </GlassCard>

            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 11,
                color: tokens.ink2,
                textAlign: "center",
                paddingHorizontal: 12,
              }}
            >
              {summary.dynamics_note}
            </Text>
          </>
        )}
      </ScrollView>

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
