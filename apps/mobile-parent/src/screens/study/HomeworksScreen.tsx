/**
 * Экран #12 «Домашние задания» (d12) — Заход 5 REBUILD.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 496–545:
 *  497–501 шапка (InnerHeader: back + заголовок + правая круглая кнопка-меню),
 *  502 контейнер-скролл (padding 4/18/118, gap 12),
 *  503–508 ряд из 4 фильтр-чипов (Все / Сегодня / Просрочено / Выполнено),
 *  509–532 пять карточек ДЗ (математика/англ/прог/робо/русский) — единая
 *   3-колоночная сетка: 40×40 плитка предмета + центр (заголовок+статус-чип,
 *   подзаголовок, мета-строка с часами) + 42×42 правый индикатор (Ring,
 *   hourglass-badge, empty-ring, прочерк),
 *  534–542 нижняя стеклянная строка-сводка из 4 колонок.
 *
 * Данные — через аксессоры src/data (getHomeworkList, getHomeworkFilterChips,
 * getHomeworkTotals, getSubject). Тексты статусов и подписи — из фикстур
 * (HOMEWORK_LIST ru-строки). Header i18n — d.parentApp.scr.homeworks.
 * Обе темы через useTheme(); iOS safe-area — из InnerHeader.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCircleButton, InnerHeader, type StatusFamily } from "../../ui";
import {
  getHomeworkFilterChips,
  getHomeworkList,
  getHomeworkTotals,
  getSubject,
} from "../../data";
import type { HomeworkCardRow, SubjectKey } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── маппинг статуса → семья цвета (макет 511/516/521/526/531). ─────────── */

function statusToFamily(label: string): StatusFamily {
  switch (label) {
    case "Выполнено":
      return "green";
    case "В работе":
      return "orange";
    case "На проверке":
      return "violet";
    case "Просрочено":
      return "red";
    default:
      return "gray"; // «Не назначено»
  }
}

/* ─── глифы плиток предметов (макет 510/515/520/525/530). ─────────────────── */

/** SVG-глиф стрелок кода «</>» для программирования (макет 520). */
const CODE_PATHS = ["m16 18 6-6-6-6", "m8 6-6 6 6 6"];

/** SVG-глиф робота (макет 525: rounded rect + antenna + eyes). */
const ROBOT_PATHS = [
  "M4 12a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z",
  "M12 8V4",
  "M9 14v1",
  "M15 14v1",
];

/** SVG-глиф карандаша (макет 530: pencil/edit). */
const PENCIL_PATHS = [
  "M12 20h9",
  "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
];

/** SVG-глиф часов 10×10 (мета-строка, макет 511 и повторы). */
const CLOCK_PATHS = ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"];

/** SVG-глиф hourglass для правого бэйджа «На проверке» (макет 522). */
const HOURGLASS_PATHS = [
  "M5 22h14",
  "M5 2h14",
  "M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22",
  "M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2",
];

/** Список три-линии — правая круглая кнопка шапки (макет 500). */
const LIST_PATHS = ["M3 6h18", "M7 12h10", "M10 18h4"];

/** Простой inline SVG-глиф в белом. */
function WhiteGlyph({ paths, size = 17, stroke = 2 }: { paths: string[]; size?: number; stroke?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/** Мини-иконка одним цветом, ширина 10–17. */
function IconGlyph({
  paths,
  size,
  color,
  stroke = 2,
}: {
  paths: string[];
  size: number;
  color: string;
  stroke?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/* ─── 40×40 плитка предмета (макет 510/515/520/525/530). ─────────────────── */

function SubjectTile({ subjectId }: { subjectId: SubjectKey }) {
  const subject = getSubject(subjectId);
  const g = gradPoints(135);
  // Цветная тень «под предмет» — как box-shadow макета (0 6 14 rgba(...,.3)).
  const shadowColorMap: Record<SubjectKey, string> = {
    math: "rgba(202,138,4,0.3)",
    eng: "rgba(219,39,119,0.3)",
    prog: "rgba(2,132,199,0.3)",
    robo: "rgba(13,148,136,0.3)",
    rus: "rgba(162,28,175,0.3)",
    rusF: "rgba(162,28,175,0.3)",
  };
  const shadow = shadowStyle({ x: 0, y: 6, blur: 14, color: shadowColorMap[subjectId] });

  let content: React.ReactNode;
  if (subjectId === "math") {
    content = <Text style={styles.tileGlyphText}>√x</Text>;
  } else if (subjectId === "eng") {
    content = <Text style={styles.tileGlyphText}>Aa</Text>;
  } else if (subjectId === "prog") {
    content = <WhiteGlyph paths={CODE_PATHS} size={17} />;
  } else if (subjectId === "robo") {
    content = <WhiteGlyph paths={ROBOT_PATHS} size={17} />;
  } else {
    // rus / rusF — карандаш
    content = <WhiteGlyph paths={PENCIL_PATHS} size={16} />;
  }

  return (
    <View style={[styles.subjectTileWrap, shadow]}>
      <LinearGradient
        colors={subject.gradient}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{content}</View>
      </View>
    </View>
  );
}

/* ─── мини-статус-чип (8.5/800, 2×7 pad) — макет строка 511 (уже). ───────── */

function MiniStatusChip({ label, family }: { label: string; family: StatusFamily }) {
  const { tokens } = useTheme();
  const st = tokens.status[family];
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 999,
        backgroundColor: `rgba(${st.rgb},0.14)`,
        borderWidth: 1,
        borderColor: `rgba(${st.rgb},0.35)`,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: st.text }}>{label}</Text>
    </View>
  );
}

/* ─── 42×42 правый индикатор карточки. ───────────────────────────────────── */

/**
 * Круговой прогресс 42×42 (r=16, thickness=4.5, viewBox 44)
 * с числовым текстом «N%» внутри — макет строки 512/517/527. Прогресс > 0 —
 * рисуем цветную дугу; для «просрочено» (0%) — только пустое красное кольцо.
 */
function ProgressRing42({
  pct,
  family,
}: {
  pct: number; // 0..100
  family: StatusFamily;
}) {
  const { tokens } = useTheme();
  const st = tokens.status[family];
  const C = 100.53; // 2*π*16 ≈ 100.5 (макет: dasharray "100.5 100.5")
  const len = (Math.max(0, Math.min(100, pct)) / 100) * C;
  const trackColor =
    pct === 0 && family === "red"
      ? `rgba(${st.rgb},0.2)` // «просрочено» — красноватый пустой трек (макет 527)
      : `rgba(23,18,67,0.09)`;

  return (
    <View style={{ width: 42, height: 42 }}>
      <Svg width={42} height={42} viewBox="0 0 44 44">
        <Circle cx={22} cy={22} r={16} fill="none" stroke={trackColor} strokeWidth={4.5} />
        {pct > 0 ? (
          <Circle
            cx={22}
            cy={22}
            r={16}
            fill="none"
            stroke={`rgb(${st.rgb})`}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={`${len} ${C}`}
            transform="rotate(-90 22 22)"
          />
        ) : null}
        <SvgText
          x={22}
          y={26}
          textAnchor="middle"
          fontSize={9.5}
          fontWeight="800"
          fill={st.text}
          fontFamily="Manrope"
        >
          {`${pct}%`}
        </SvgText>
      </Svg>
    </View>
  );
}

/** Круглый бэйдж 42×42 с фиолетовой заливкой и hourglass (макет 522). */
function HourglassBadge() {
  const { tokens } = useTheme();
  const st = tokens.status.violet;
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `rgba(${st.rgb},0.12)`,
        borderWidth: 1,
        borderColor: `rgba(${st.rgb},0.3)`,
      }}
    >
      <IconGlyph paths={HOURGLASS_PATHS} size={17} color={st.text} stroke={1.9} />
    </View>
  );
}

/** Круглый серый бэйдж 42×42 с прочерком «—» (макет 532). */
function DashBadge() {
  const { tokens } = useTheme();
  const st = tokens.status.gray;
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `rgba(${st.rgb},0.1)`,
        borderWidth: 1,
        borderColor: `rgba(${st.rgb},0.25)`,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: st.text }}>—</Text>
    </View>
  );
}

/* ─── фильтр-чипы. ────────────────────────────────────────────────────────── */

type FilterKey = "all" | "today" | "late" | "done";

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const activeBg =
    scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(23,18,67,0.09)";
  const inactiveBg =
    scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: active ? activeBg : inactiveBg,
          borderWidth: 1,
          borderColor: scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(23,18,67,0.06)",
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 10.5,
          color: active ? tokens.ink1 : tokens.ink2,
        }}
      >
        {`${label} · ${count}`}
      </Text>
    </Pressable>
  );
}

/* ─── карточка ДЗ. ────────────────────────────────────────────────────────── */

function HomeworkCard({
  row,
  onPress,
}: {
  row: HomeworkCardRow;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const subject = getSubject(row.subject_id);
  const family = statusToFamily(row.status_label);
  const st = tokens.status[family];

  // Мета-строка: цвет и жирность зависят от статуса (макет 511/516/521/526/531).
  const emphMeta = family === "orange" || family === "red";
  const metaColor = emphMeta ? st.text : scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)";
  const metaWeight = emphMeta ? fonts.manrope800 : fonts.manrope700;

  const subtitleColor = scheme === "dark" ? "rgba(255,255,255,0.65)" : "rgba(26,19,74,0.66)";

  // Правый индикатор — по типу progress.
  let right: React.ReactNode;
  if (row.progress === "hourglass") {
    right = <HourglassBadge />;
  } else if (row.progress === null) {
    right = <DashBadge />;
  } else {
    right = <ProgressRing42 pct={row.progress} family={family} />;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadowStyle(tokens.shCard),
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
            : ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.46)"]
        }
        {...gradPoints(160)}
        style={StyleSheet.absoluteFill}
      />
      {/* inset-блик стекла */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: tokens.glassInset.y,
          backgroundColor: tokens.glassInset.color,
        }}
      />
      <View style={styles.cardContent}>
        <SubjectTile subjectId={row.subject_id} />
        <View style={styles.cardCenter}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text
              style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
              numberOfLines={1}
            >
              {subject.name}
            </Text>
            <MiniStatusChip label={row.status_label} family={family} />
          </View>
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: subtitleColor }}
          >
            {row.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <IconGlyph paths={CLOCK_PATHS} size={10} color={metaColor} stroke={2} />
            <Text
              style={{ fontFamily: metaWeight, fontSize: 9.5, color: metaColor }}
              numberOfLines={1}
            >
              {row.due_label}
            </Text>
          </View>
        </View>
        {right}
      </View>
    </Pressable>
  );
}

/* ─── нижняя строка-сводка. ──────────────────────────────────────────────── */

function SummaryCol({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  const { tokens, scheme } = useTheme();
  const labelColor = scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.55)";
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color }}>{value}</Text>
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 8.5, color: labelColor }}>{label}</Text>
    </View>
  );
}

function SummaryStatsBar({
  total,
  done,
  underReview,
  overdue,
}: {
  total: number;
  done: number;
  underReview: number;
  overdue: number;
}) {
  const { tokens, scheme } = useTheme();
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.08)";

  return (
    <View style={[styles.summaryBar, shadowStyle(tokens.shCard)]}>
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
            : ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.46)"]
        }
        {...gradPoints(160)}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: tokens.glassInset.y,
          backgroundColor: tokens.glassInset.color,
        }}
      />
      <View style={styles.summaryContent}>
        <SummaryCol value={String(total)} label="Всего" color={tokens.ink1} />
        <View style={[styles.summaryDivider, { backgroundColor: dividerColor }]} />
        <SummaryCol value={String(done)} label="Выполнено" color={tokens.status.green.text} />
        <View style={[styles.summaryDivider, { backgroundColor: dividerColor }]} />
        <SummaryCol
          value={String(underReview)}
          label="На проверке"
          color={tokens.status.violet.text}
        />
        <View style={[styles.summaryDivider, { backgroundColor: dividerColor }]} />
        <SummaryCol
          value={String(overdue)}
          label="Просрочено"
          color={tokens.status.red.text}
        />
      </View>
    </View>
  );
}

/* ═══ Экран ═══════════════════════════════════════════════════════════════ */

export default function HomeworksScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const chips = getHomeworkFilterChips(); // [{label, count}] × 4
  const list = getHomeworkList();
  const totals = getHomeworkTotals();

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // Фильтрация списка (Сегодня/Просрочено/Выполнено). «Сегодня» = due_label
  // содержит «сегодня» / «завтра» — простая эвристика фикстур (макет: у Мат
  // «Сдано сегодня, 10:15», у Англ «Срок: завтра, 18:00» — 2 карточки).
  const visible = useMemo<HomeworkCardRow[]>(() => {
    switch (activeFilter) {
      case "today":
        return list.filter(
          (r) => r.due_label.indexOf("сегодня") >= 0 || r.due_label.indexOf("завтра") >= 0,
        );
      case "late":
        return list.filter((r) => r.status_label === "Просрочено");
      case "done":
        return list.filter((r) => r.status_label === "Выполнено");
      default:
        return list;
    }
  }, [activeFilter, list]);

  return (
    <AppBackground>
      <InnerHeader
        title={d.parentApp.scr.homeworks}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => setActiveFilter("all")}>
            <IconGlyph paths={LIST_PATHS} size={16} color={tokens.ink1} stroke={1.8} />
          </GlassCircleButton>
        }
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
        {/* Ряд фильтр-чипов (макет 503–508). */}
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {chips.map((c, i) => {
            const keys: FilterKey[] = ["all", "today", "late", "done"];
            const key = keys[i] ?? "all";
            return (
              <FilterChip
                key={c.label}
                label={c.label}
                count={c.count}
                active={activeFilter === key}
                onPress={() => setActiveFilter(key)}
              />
            );
          })}
        </View>

        {/* Пять карточек ДЗ (макет 509–532). */}
        {visible.map((row) => (
          <HomeworkCard key={row.id} row={row} onPress={() => navigation.navigate("d13")} />
        ))}

        {/* Стеклянная строка-сводка (макет 534–542). */}
        <SummaryStatsBar
          total={totals.total}
          done={totals.done}
          underReview={totals.under_review}
          overdue={totals.overdue}
        />
      </ScrollView>
    </AppBackground>
  );
}

/* ─── стили. ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  subjectTileWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tileGlyphText: {
    fontFamily: fonts.manrope800,
    fontSize: 13,
    color: "#FFFFFF",
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardCenter: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryBar: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
  },
  summaryContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
  },
});
