/**
 * d16 «Навыки и развитие» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: индекс 4.6/5.0 и 92 % константами, шестиосевой радар с выдуманными
 * значениями (Логика 4.8, Креатив 4.2, Команда 4.3 …), шесть плиток навыков,
 * готовая «рекомендация помощника» и два пункта «для практики» — всё
 * вкомпилировано в файл. Ни одной цифры из базы.
 *
 * СТАЛО: `getChildSkills` из @snr/core — та же формула, что на вебе, и она
 * же написана внизу самого экрана:
 *   Знания          = средний балл по всем предметам / 5
 *   Мышление        = средний балл по точным предметам / 5
 *   Общение         = средний балл по языкам и гуманитарным / 5
 *   Самостоятельность = доля сданных домашних работ
 *   Дисциплина      = посещаемость уроков
 *
 * ЧТО УБРАНО И ПОЧЕМУ:
 *  • радар на шесть осей — осей ровно пять, и шестую («Команда», «Креатив»)
 *    взять неоткуда: ни одна таблица о них ничего не знает. Вместо радара —
 *    пять шкал, они несут то же самое и ничего не досочиняют;
 *  • «Творчество» из макета: оценивать творчество в проекте нечем;
 *  • рекомендация помощника и список «для практики»: это был готовый текст в
 *    файле, а не разбор чего-либо. Разбор помощника — отдельный экран со
 *    своей таблицей (parent_insights), сюда его не подменяем.
 *
 * Полукруглая шкала сверху осталась — она показывает НАСТОЯЩИЙ общий уровень.
 */
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Path, Polygon, Text as SvgText } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { format, getChildSkills, getHomeworkWithSubmissions, getStudentAttendance, type ChildSkills } from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  AccentCard,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  LoadingBlock,
  ProgressBar,
  SectionHeader,
  StatusChip,
} from "../../ui";
import { useChildQuery } from "../../hooks/useChildScope";
import { useShowcaseChild } from "../../hooks/useShowcaseChild";
import { getSkillsScreen, getSubject } from "../../data";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Градиент шкалы навыка — свой на каждый, как плитки в макете. */
const SKILL_GRADIENT: Record<ChildSkills["skills"][number]["key"], [string, string]> = {
  knowledge: ["#a78bfa", "#7c3aed"],
  thinking: ["#60a5fa", "#2563eb"],
  communication: ["#34d399", "#059669"],
  independence: ["#f472b6", "#db2777"],
  discipline: ["#fbbf24", "#f97316"],
};

/** Уровень по проценту — те же пороги, что на вебе. */
function levelOf(pct: number): { key: "High" | "Good" | "Growing" | "Low"; family: "green" | "blue" | "orange" | "red" } {
  if (pct >= 85) return { key: "High", family: "green" };
  if (pct >= 70) return { key: "Good", family: "blue" };
  if (pct >= 50) return { key: "Growing", family: "orange" };
  return { key: "Low", family: "red" };
}

function InfoCircleGlyph({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round">
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </Svg>
  );
}

/**
 * Радар «Профиль навыков» витрины — шесть осей, разметка 663 макета.
 *
 * Полигоны дословно из макета (система координат 120×108, центр 60,54).
 * viewBox расширен наружу, чтобы подписи вершин помещались рядом с
 * фигурой, а не заезжали на неё: сама фигура при этом не сдвинута ни на
 * пиксель — меняется только окно просмотра.
 *
 * Подписи вершин — короткие формы из общего словаря (skills.axis*), они
 * уже подобраны по длине под «имя + число».
 */
function SkillsRadar({
  radar,
  vertices,
  stroke,
  fill,
}: {
  radar: { frame: string; grid: string; values: string };
  vertices: { label: string; x: number; y: number; anchor: "start" | "middle" | "end" }[];
  stroke: string;
  fill: string;
}) {
  return (
    <Svg width={240} height={186} viewBox="-24 -8 168 124">
      <Polygon points={radar.frame} fill="none" stroke={stroke} strokeWidth={1.2} />
      <Polygon points={radar.grid} fill="none" stroke={stroke} strokeWidth={1} />
      <Polygon points={radar.values} fill={fill} stroke="#7c3aed" strokeWidth={1.6} />
      {vertices.map((v) => (
        <SvgText
          key={v.label}
          x={v.x}
          y={v.y}
          textAnchor={v.anchor}
          fontSize={7}
          fontWeight="700"
          fill={stroke}
          fontFamily={fonts.manrope700}
        >
          {v.label}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Полукруглая шкала общего уровня (геометрия макета: центр 60,62, r 48). */
function OverallSemicircle({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(1, percent / 100));
  const theta = Math.PI * pct;
  const cx = 60, cy = 62, r = 48;
  const startX = cx + r * Math.cos(Math.PI);
  const startY = cy - r * Math.sin(Math.PI);
  const endX = cx + r * Math.cos(Math.PI - theta);
  const endY = cy - r * Math.sin(Math.PI - theta);
  const progressPath = `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${r} ${r} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
  return (
    <Svg width={110} height={66} viewBox="0 0 120 70">
      <Path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={10} strokeLinecap="round" />
      {pct > 0 ? (
        <Path d={progressPath} fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" />
      ) : null}
      <SvgText x={60} y={60} textAnchor="middle" fontSize={13} fontWeight="800" fill="#FFFFFF" fontFamily={fonts.manrope800}>
        {`${percent}%`}
      </SvgText>
    </Svg>
  );
}

function CapsLabel({ children }: { children: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        textTransform: "uppercase",
        color: tokens.ink3,
      }}
    >
      {children}
    </Text>
  );
}

export default function SkillsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m3 = t.more3;
  const m4 = t.more4;
  const navigation = useNavigation<Nav>();

  const sc = t.showcase;
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Витрина. Индекс 4.6 и 92% отдаются как в макете: между собой они
  // согласованы (4.6 / 5.0 = 92%), а среднему шести осей (4.4) не равны —
  // формулы индекса макет не задаёт, и выводить её самим было бы выдумкой.
  const витрина = getSkillsScreen(locale);
  // Короткие подписи вершин — из словаря, порядок совпадает с осями.
  const КОРОТКО: Record<string, string> = {
    logic: t.skills.axisLogic,
    communication: t.skills.axisCommunication,
    independence: t.skills.axisIndependence,
    creativity: t.skills.axisCreativity,
    discipline: t.skills.axisDiscipline,
    teamwork: t.skills.axisTeamwork,
  };
  // Координаты подписей — рядом с вершинами шестиугольника макета
  // (60,10 · 98,32 · 98,76 · 60,98 · 22,76 · 22,32), отодвинуты наружу.
  const ВЕРШИНЫ: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
    { x: 60, y: 2, anchor: "middle" },
    { x: 103, y: 28, anchor: "start" },
    { x: 103, y: 82, anchor: "start" },
    { x: 60, y: 108, anchor: "middle" },
    { x: 17, y: 82, anchor: "end" },
    { x: 17, y: 28, anchor: "end" },
  ];

  // Посещаемость и домашние задания читаются теми же функциями, что питают
  // экраны «Посещаемость» и «Домашние задания», — второй копии выборки нет.
  const state = useChildQuery(realChildId, async (db, id) => {
    const [attendance, homework] = await Promise.all([
      getStudentAttendance(db, undefined, id),
      getHomeworkWithSubmissions(db, id),
    ]);
    return getChildSkills(db, id, { attendance, homework });
  });

  const data = state.data;
  const empty = !data || data.source.gradeCount === 0;

  const NAME: Record<string, string> = {
    knowledge: m3.skillKnowledge,
    thinking: m3.skillThinking,
    communication: m3.skillCommunication,
    independence: m3.skillIndependence,
    discipline: m3.skillDiscipline,
  };
  const WHY: Record<string, string> = {
    knowledge: m3.skillKnowledgeWhy,
    thinking: m3.skillThinkingWhy,
    communication: m3.skillCommunicationWhy,
    independence: m3.skillIndependenceWhy,
    discipline: m3.skillDisciplineWhy,
  };
  const LEVEL: Record<string, string> = {
    High: m3.skillLevelHigh,
    Good: m3.skillLevelGood,
    Growing: m3.skillLevelGrowing,
    Low: m3.skillLevelLow,
  };

  return (
    <AppBackground>
      <InnerHeader
        title={t.scr.skills}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("stub", { stubKey: "help" })}>
            <InfoCircleGlyph color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {child ? (
          <ChildSwitcherCard
            variant="compact"
            avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
            name={child.full_name}
            classLabel={`${child.class_name} ${t.grades.class}`}
            onPress={() => setPickerOpen(true)}
          />
        ) : null}

        {showcase ? (
          <>
            {/* Общий индекс (658–659). */}
            <AccentCard
              gradient={["#22d3ee", "#3b82f6"]}
              shadowRgb="59,130,246"
              radius={22}
              contentStyle={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ flex: 1, gap: 5 }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 9,
                    letterSpacing: 9 * 0.08,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {sc.overallIndexCap}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                  <Text style={{ fontFamily: fonts.unbounded700, fontSize: 26, color: "#FFFFFF" }}>
                    {витрина.overall_label}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: "rgba(255,255,255,0.85)", paddingBottom: 4 }}>
                    {`/${витрина.overall_max_label}`}
                  </Text>
                </View>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                  {витрина.overall_note}
                </Text>
              </View>
              <OverallSemicircle percent={витрина.overall_pct} />
            </AccentCard>

            {/* Профиль навыков: радар и список шести осей (662–671). */}
            <SectionHeader title={t.skills.profile} />
            <GlassCard radius={22} contentStyle={{ padding: 14, gap: 10 }}>
              <View style={{ alignItems: "center" }}>
                <SkillsRadar
                  radar={витрина.radar}
                  stroke={tokens.ink3}
                  fill="rgba(124,58,237,0.22)"
                  vertices={витрина.axes.map((a, i) => ({
                    label: `${КОРОТКО[a.key] ?? a.name} ${a.value_label}`,
                    x: ВЕРШИНЫ[i].x,
                    y: ВЕРШИНЫ[i].y,
                    anchor: ВЕРШИНЫ[i].anchor,
                  }))}
                />
              </View>
              {витрина.axes.map((a, i) => (
                <View
                  key={a.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingTop: i === 0 ? 0 : 8,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <Text style={{ width: 34, fontFamily: fonts.manrope800, fontSize: 13, color: tokens.accent }}>
                    {a.value_label}
                  </Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>
                    {a.name}
                  </Text>
                </View>
              ))}
            </GlassCard>

            {/* Реплика помощника (675). */}
            <AccentCard
              gradient={["#8b5cf6", "#6366f1"]}
              shadowRgb="139,92,246"
              radius={20}
              contentStyle={{ padding: 14, gap: 6 }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>EduOS Assistant</Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 17, color: "rgba(255,255,255,0.92)" }}>
                {витрина.assistant_note}
              </Text>
            </AccentCard>

            {/* Рекомендации для практики (678–681). */}
            <SectionHeader title={t.skills.practice} />
            {витрина.practice.map((p) => {
              const sb = getSubject(p.subject_id);
              return (
                <GlassCard
                  key={p.title}
                  radius={18}
                  contentStyle={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 11 }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: sb.color,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>{p.glyph}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                      {p.title}
                    </Text>
                    <Text numberOfLines={2} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                      {p.meta_label}
                    </Text>
                  </View>
                </GlassCard>
              );
            })}
          </>
        ) : childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : empty ? (
          <EmptyBlock
            title={m3.skillEmptyTitle}
            text={format(m3.skillEmptyText, { name: child?.first_name ?? "" })}
          />
        ) : (
          <>
            {/* Общий уровень — настоящий средний по пяти навыкам. */}
            <AccentCard
              gradient={["#22d3ee", "#3b82f6"]}
              shadowRgb="59,130,246"
              radius={22}
              contentStyle={{ padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 28, color: "#FFFFFF", lineHeight: 32 }}>
                  {`${data!.overall}%`}
                </Text>
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>
                  {m3.skillOverall}
                </Text>
                <View style={{ alignSelf: "flex-start" }}>
                  <StatusChip label={LEVEL[levelOf(data!.overall).key]} family={levelOf(data!.overall).family} />
                </View>
                {/* 25.08.2026: общий уровень смешивает оценки с посещаемостью
                    и сданными работами — говорим об этом прямо. Та же подпись,
                    что на вебе, из общего словаря. */}
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: "rgba(255,255,255,0.75)", lineHeight: 13 }}>
                  {m3.skillOverallNote}
                </Text>
              </View>
              <OverallSemicircle percent={data!.overall} />
            </AccentCard>

            {/* Пять шкал. Под каждой — из чего она сложилась. */}
            <GlassCard radius={22} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {data!.skills.map((s, idx) => {
                const g = SKILL_GRADIENT[s.key];
                const lvl = levelOf(s.pct);
                return (
                  <View
                    key={s.key}
                    style={{
                      gap: 6,
                      paddingTop: 13,
                      paddingBottom: 13,
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: "rgba(23,18,67,0.07)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                        {NAME[s.key]}
                      </Text>
                      <StatusChip label={LEVEL[lvl.key]} family={lvl.family} />
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: g[1], minWidth: 36, textAlign: "right" }}>
                        {`${s.pct}%`}
                      </Text>
                    </View>
                    <ProgressBar pct={s.pct / 100} height={6} fillGradient={g} />
                    <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}>
                      {s.basis.subjects && s.basis.subjects.length > 0
                        ? `${WHY[s.key]}: ${s.basis.subjects.join(", ")}`
                        : WHY[s.key]}
                    </Text>
                  </View>
                );
              })}
            </GlassCard>

            {/* Предметы со средним баллом. */}
            <SectionHeader title={m3.skillSubjectsCap} />
            <GlassCard radius={22} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {data!.subjects.map((s, idx) => (
                <View
                  key={s.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingTop: 11,
                    paddingBottom: 11,
                    borderTopWidth: idx > 0 ? 1 : 0,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: s.color ?? tokens.accent }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                    {s.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                    {format(m3.skillSubjectMeta, { n: String(s.count) })}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                    {s.average.toFixed(1)}
                  </Text>
                </View>
              ))}
            </GlassCard>

            {/* Из чего всё посчитано — не украшение: экран показывает
                выведенные числа, и родитель должен видеть, что за ними стоит. */}
            <CapsLabel>{m4.skillsSourceCap}</CapsLabel>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9,
                lineHeight: 14,
                color: tokens.ink3,
                paddingHorizontal: 2,
              }}
            >
              {format(m3.skillNote, {
                grades: String(data!.source.gradeCount),
                present: String(data!.source.attendancePresent),
                total: String(data!.source.attendanceTotal),
                done: String(data!.source.homeworkSubmitted),
                hw: String(data!.source.homeworkTotal),
              })}
            </Text>
          </>
        )}
      </ScrollView>

      <BottomSheetFrame visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={childId ?? undefined}
          onSelect={(id) => {
            selectChild(id);
            setPickerOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}
