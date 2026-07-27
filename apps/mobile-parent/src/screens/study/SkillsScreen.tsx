/**
 * Экран #16 «Навыки и развитие» — заход 5.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 649–684:
 *  650–654 InnerHeader: back-круг 38 + заголовок Unbounded 15/600 t.scr.skills
 *          + info-circle 17 справа (без действия);
 *  656 ChildSwitcher (compact, glass r18) — аватар 44 + ФИО + класс + шеврон;
 *  657–660 OverallIndexCard — гриент 135° #22d3ee→#3b82f6, слева индекс 4.6/5.0
 *          + подпись «Отличный прогресс за год», справа semi-circle gauge 110×66
 *          (viewBox 120×70) с двумя path: базовый rgba(W,.3) width 10 и прогресс
 *          #FFF (92%: конечная точка ≈ угол arcsin вычислен как 12,62 → 101,33
 *          в макете), внизу текст 92% Manrope 800 13;
 *  661–664 GlassCard «Профиль навыков» — caps-label ссверху-слева, ниже Radar
 *          240×196 с 6 подписями «Логика 4.8, Комм. 3.8, Самост. 4.5,
 *          Креатив 4.2, Дисц. 4.7, Команда 4.3» (fillColor rgba(59,130,246,.24),
 *          strokeColor #3b82f6);
 *  665–672 SkillsGrid 3×2 mini-cards — каждая glass r14, padding 9 6, слева
 *          icon-square 26×26 с градиентом 135° и SVG-глифом, справа колонка
 *          score 11.5/800 + name 7.5/700 (макет: Логика/Коммуникация/Самост./
 *          Креативность/Дисциплина/Команда);
 *  673–677 AccentCard EduOS Assistant — grad 135° #8b5cf6→#6366f1 c sparkle-глифом
 *          и текстом «Сильные стороны — логика и дисциплина. Рекомендуем развивать
 *          коммуникацию через участие в проектах и дебатах.» + шеврон-›;
 *  678       caps-label «t.skillsPractice» (Рекомендации для практики);
 *  679–682 PracticeList — glass r20, 2 строки с разделителем 1px rgba(23,18,67,.07):
 *          #1 pink «Aa» + «Past Simple — практика речи» + subtitle + чип
 *          «Подробнее»; #2 amber «√x» + «Геометрия: углы и треугольники» +
 *          subtitle + чип «Подробнее».
 *
 * Данные — константы блока (значения макета дословно), контекст ребёнка через
 * getSelectedChildContext(). Тексты — через useAppLocale().d.parentApp.*
 * (scr.skills, skills.profile, skills.practice, grades.class). Обе темы через
 * useTheme(); iOS safe-area — из InnerHeader; скролл имеет paddingBottom 118
 * под FloatingTabBar (макет строка 655: «padding:4px 18px 118px»).
 *
 * РАДАР — решение по overflow: макет использует viewBox='-14 0 148 108' style=
 * 'overflow:visible', в react-native-svg overflow:visible ненадёжно.
 * Здесь используется штатный компонент ../../ui/charts/Radar с labels-режимом:
 * его viewBox уже равен '-14 0 148 108' (совпадает с макетом), а подписи
 * расположены точно на границе (x=18/102). Оборачиваем Svg во View с
 * overflow:'visible' и добавляем 4px горизонтального запаса — этого достаточно,
 * чтобы «Дисц. 4.7» и «Комм. 3.8» не срезались на iOS. При появлении артефактов
 * на Android — расширить viewBox Radar до '-20 0 160 108'.
 *
 * Правила заказчика: экран содержит ТОЛЬКО навыки/развитие — нет посещаемости,
 * расписания, кружков. Все данные соответствуют скиллам ребёнка.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  InnerHeader,
  Radar,
  type ChildPickerItem,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getSelectedChildContext,
} from "../../data";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/* ─────────────────────────────────────────────────────────────────────────────
 * Значения макета (строки 657–681). Все имена/оценки/градиенты — дословно.
 * ────────────────────────────────────────────────────────────────────────── */

/** Общий индекс развития (строка 658). */
const OVERALL_INDEX = "4.6";
const OVERALL_MAX = "/5.0";
const OVERALL_PERCENT = 92;
const OVERALL_COMMENT = "Отличный прогресс за год";

/** 6 значений радара (строка 663): «Логика 4.8 Комм. 3.8 Самост. 4.5
 *  Креатив 4.2 Дисц. 4.7 Команда 4.3». Порядок = порядок осей: верх → низ
 *  по часовой (см. Radar/LABEL_POS). */
const RADAR_LABELS: [string, string, string, string, string, string] = [
  "Логика 4.8",
  "Комм. 3.8",
  "Самост. 4.5",
  "Креатив 4.2",
  "Дисц. 4.7",
  "Команда 4.3",
];
const RADAR_VALUES: [number, number, number, number, number, number] = [
  4.8, 3.8, 4.5, 4.2, 4.7, 4.3,
];

/** 6 mini-cards (строки 666–671): значение, название, градиент 135° и SVG-глиф. */
type SkillGlyph = "logic" | "comm" | "indep" | "creativ" | "discip" | "team";
interface SkillItem {
  score: string;
  name: string;
  gradient: [string, string];
  shadowRgb: string;
  glyph: SkillGlyph;
}
const SKILL_ITEMS: SkillItem[] = [
  { score: "4.8", name: "Логика", gradient: ["#a78bfa", "#7c3aed"], shadowRgb: "124,58,237", glyph: "logic" },
  { score: "3.8", name: "Коммуникация", gradient: ["#34d399", "#059669"], shadowRgb: "5,150,105", glyph: "comm" },
  { score: "4.5", name: "Самостоятельн.", gradient: ["#60a5fa", "#2563eb"], shadowRgb: "37,99,235", glyph: "indep" },
  { score: "4.2", name: "Креативность", gradient: ["#f472b6", "#db2777"], shadowRgb: "219,39,119", glyph: "creativ" },
  { score: "4.7", name: "Дисциплина", gradient: ["#fbbf24", "#f97316"], shadowRgb: "249,115,22", glyph: "discip" },
  { score: "4.3", name: "Команда", gradient: ["#2dd4bf", "#0d9488"], shadowRgb: "13,148,136", glyph: "team" },
];

/** Ассистентский текст (строка 675) — от EduOS Assistant. */
const ASSISTANT_RECOMMENDATION =
  "Сильные стороны — логика и дисциплина. Рекомендуем развивать коммуникацию через участие в проектах и дебатах.";

/** Строки блока «Что попрактиковать» (679–681). Subject-icon как в макете:
 *  «Aa» (eng, pink #f472b6→#db2777) и «√x» (math, amber #facc15→#ca8a04). */
interface PracticeItem {
  glyph: string;
  gradient: [string, string];
  shadowRgb: string;
  title: string;
  subtitle: string;
}
const PRACTICE_ITEMS: PracticeItem[] = [
  {
    glyph: "Aa",
    gradient: ["#f472b6", "#db2777"],
    shadowRgb: "219,39,119",
    title: "Past Simple — практика речи",
    subtitle: "Английский язык · 5 упражнений по теме",
  },
  {
    glyph: "√x",
    gradient: ["#facc15", "#ca8a04"],
    shadowRgb: "202,138,4",
    title: "Геометрия: углы и треугольники",
    subtitle: "Математика · задачи для тренировки к тесту",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Вспомогательные визуальные детали.
 * ────────────────────────────────────────────────────────────────────────── */

/** Info-circle 17 из макета (строка 653) — правый слот InnerHeader. */
function InfoCircleGlyph() {
  const { tokens } = useTheme();
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={tokens.ink3} strokeWidth={1.9} />
      <Path
        d="M12 16v-4"
        stroke={tokens.ink3}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d="M12 8h.01"
        stroke={tokens.ink3}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Полукруговой индикатор общего индекса (строка 659), viewBox 120×70. */
function OverallSemicircle({ percent }: { percent: number }) {
  // База — путь от (12,62) до (108,62), радиус 48 — как в макете.
  // Прогресс: угол от 180° (левая точка) до (180° − 180°·pct) вдоль верхней дуги.
  // Финальная точка = (60 + 48·cos θ, 62 − 48·sin θ), где θ = 180°·pct.
  const pct = Math.max(0, Math.min(1, percent / 100));
  const theta = Math.PI * pct; // от π (0%) до 0 (100%) — идём против часовой
  // Углы: старт левая точка при θ=π: x = 60+48·cos(π) = 12, y = 62 − 48·sin(π) = 62.
  // Конечная точка при текущем θ:
  const cx = 60;
  const cy = 62;
  const r = 48;
  const startX = cx + r * Math.cos(Math.PI);
  const startY = cy - r * Math.sin(Math.PI);
  const endX = cx + r * Math.cos(Math.PI - theta);
  const endY = cy - r * Math.sin(Math.PI - theta);
  // SVG arc: A rx ry x-axis-rot large-arc sweep endX endY
  // sweep=1 — против часовой (по нашему полукругу вверх).
  const progressPath = `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${r} ${r} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
  return (
    <Svg width={110} height={66} viewBox="0 0 120 70">
      {/* Базовая дуга полупрозрачная (строка 659, W30). */}
      <Path
        d="M12 62 A48 48 0 0 1 108 62"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Прогресс белый до угла pct·180°. */}
      <Path
        d={progressPath}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <SvgText
        x={60}
        y={60}
        textAnchor="middle"
        fontSize={13}
        fontWeight="800"
        fill="#FFFFFF"
        fontFamily={fonts.manrope800}
      >
        {`${percent}%`}
      </SvgText>
    </Svg>
  );
}

/** SVG-глиф для mini-card (12×12, белый, макет строки 666–671). */
function SkillGlyphSvg({ kind }: { kind: SkillGlyph }) {
  const props = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#FFFFFF",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "logic":
      return (
        <Svg {...props}>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 8v8" />
          <Path d="M8 12h8" />
        </Svg>
      );
    case "comm":
      return (
        <Svg {...props}>
          <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </Svg>
      );
    case "indep":
      return (
        <Svg {...props}>
          <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <Circle cx={12} cy={7} r={4} />
        </Svg>
      );
    case "creativ":
      return (
        <Svg {...props}>
          <Path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </Svg>
      );
    case "discip":
      return (
        <Svg {...props}>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v5l3 2" />
        </Svg>
      );
    case "team":
      return (
        <Svg {...props}>
          <Path d="M18 21a8 8 0 0 0-16 0" />
          <Circle cx={10} cy={8} r={5} />
          <Path d="M22 20c0-3.4-2-6.3-5-7.4" />
          <Path d="M16 3.1a5 5 0 0 1 0 9.8" />
        </Svg>
      );
  }
}

/** Sparkle 15×15 белый — глиф в AccentCard EduOS Assistant (строка 674). */
function SparkleGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="#FFFFFF">
      <Path d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z" />
    </Svg>
  );
}

/** Шеврон › белый 16 (строка 676). */
function ChevronRightWhite({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 18 6-6-6-6"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Caps-label uppercase 10.5 800 letter-spacing .08em ink3 (строки 662, 678). */
function CapsLabel({ children, tone = "ink3" }: { children: string; tone?: "ink3" | "white" }) {
  const { tokens } = useTheme();
  const color = tone === "white" ? "rgba(255,255,255,0.8)" : tokens.ink3;
  const fontSize = tone === "white" ? 9.5 : 10.5;
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize,
        letterSpacing: fontSize * 0.08,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Экран.
 * ────────────────────────────────────────────────────────────────────────── */

export default function SkillsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

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

  return (
    <AppBackground>
      {/* 1. TopBar — InnerHeader с back + title + info-circle справа. */}
      <InnerHeader
        title={d.parentApp.scr.skills}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={<InfoCircleGlyph />}
      />

      {/* 2. ScrollContainer — padding 4/18/118, gap 12 между блоками. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. ChildSwitcher — compact glass card. */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* 4. OverallIndexCard — cyan/blue gradient. */}
        <AccentCard
          gradient={["#22d3ee", "#3b82f6"]}
          angle={135}
          shadowRgb="59,130,246"
          radius={22}
          contentStyle={{
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <CapsLabel tone="white">ОБЩИЙ ИНДЕКС РАЗВИТИЯ</CapsLabel>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
              <Text
                style={{
                  fontFamily: fonts.unbounded600,
                  fontSize: 28,
                  lineHeight: 28,
                  color: "#FFFFFF",
                }}
              >
                {OVERALL_INDEX}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.75)",
                  paddingBottom: 2,
                }}
              >
                {OVERALL_MAX}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {OVERALL_COMMENT}
            </Text>
          </View>
          <OverallSemicircle percent={OVERALL_PERCENT} />
        </AccentCard>

        {/* 5. SkillsRadarCard — glass card «ПРОФИЛЬ НАВЫКОВ» + hex-радар с 6 подписями. */}
        <GlassCard
          radius={20}
          contentStyle={{
            padding: 14,
            gap: 4,
            alignItems: "center",
          }}
        >
          <View style={{ alignSelf: "stretch" }}>
            <CapsLabel>{d.parentApp.skills.profile}</CapsLabel>
          </View>
          {/* overflow:'visible' + горизонтальный запас — чтобы подписи «Дисц. 4.7»
              и «Комм. 3.8» не срезались (viewBox Radar заканчивается ровно на x=18/102). */}
          <View style={{ overflow: "visible", paddingHorizontal: 4 }}>
            <Radar
              values={RADAR_VALUES}
              max={5}
              size={240}
              labels={RADAR_LABELS}
              labelFontSize={7.5}
              fillColor="rgba(59,130,246,0.24)"
              strokeColor="#3b82f6"
              strokeWidth={2}
            />
          </View>
        </GlassCard>

        {/* 6. SkillsGrid — 3×2 mini-cards. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SKILL_ITEMS.map((s) => (
            <View
              key={s.name}
              style={{
                flexBasis: "31%",
                flexGrow: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingVertical: 9,
                paddingHorizontal: 6,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.glassBorder,
                backgroundColor: "rgba(255,255,255,0.4)",
              }}
            >
              <LinearGradient
                colors={s.gradient}
                {...gradPoints(135)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SkillGlyphSvg kind={s.glyph} />
              </LinearGradient>
              <View style={{ minWidth: 0, flexShrink: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 11.5,
                    color: tokens.ink1,
                  }}
                >
                  {s.score}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 7.5,
                    color: tokens.ink3,
                  }}
                >
                  {s.name}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 7. AssistantRecommendationCard — violet gradient CTA. */}
        <AccentCard
          gradient={["#8b5cf6", "#6366f1"]}
          angle={135}
          shadowRgb="99,102,241"
          radius={20}
          contentStyle={{
            padding: 12,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
          onPress={() => navigation.navigate("d7")}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SparkleGlyph />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12.5,
                color: "#FFFFFF",
              }}
            >
              EduOS Assistant
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 11,
                lineHeight: 11 * 1.5,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {ASSISTANT_RECOMMENDATION}
            </Text>
          </View>
          <View style={{ paddingTop: 3 }}>
            <ChevronRightWhite />
          </View>
        </AccentCard>

        {/* 8. SectionLabel «t.skillsPractice». */}
        <CapsLabel>{d.parentApp.skills.practice}</CapsLabel>

        {/* 9. PracticeList — glass r20, 2 строки с разделителем. */}
        <GlassCard
          radius={20}
          contentStyle={{
            paddingVertical: 5,
            paddingHorizontal: 14,
          }}
        >
          {PRACTICE_ITEMS.map((it, i) => (
            <Pressable
              key={it.title}
              onPress={() => navigation.navigate("d11")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.07)",
              }}
            >
              <LinearGradient
                colors={it.gradient}
                {...gradPoints(135)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 12,
                    color: "#FFFFFF",
                  }}
                >
                  {it.glyph}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 12,
                    color: tokens.ink1,
                  }}
                >
                  {it.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: tokens.ink2,
                  }}
                >
                  {it.subtitle}
                </Text>
              </View>
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: `rgba(${tokens.status.violet.rgb},0.14)`,
                  borderWidth: 1,
                  borderColor: `rgba(${tokens.status.violet.rgb},0.35)`,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 9.5,
                    color: tokens.status.violet.text,
                  }}
                >
                  Подробнее
                </Text>
              </View>
            </Pressable>
          ))}
        </GlassCard>
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
