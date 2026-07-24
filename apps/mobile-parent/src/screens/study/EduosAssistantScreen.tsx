/**
 * Экран #7 — EduOS Assistant (родительский AI-помощник).
 * Заход 5, пересборка block-by-block из «SNR EduOS v2 Light.dc.html»,
 * строки 1333–1362.
 *
 * Порядок блоков:
 *  1. Header (InnerHeader) — стрелка + «EduOS Assistant» Unbounded 15/600 +
 *     круглый бейдж 38 с градиентом #7c3aed → #4f6df5 и текстом «AI»
 *     (макет 1334–1338).
 *  2. Scroll-контейнер контента (макет 1339, padding 4/18/118, gap 12).
 *  3. AI Overall Insight card — AccentCard #8b5cf6 → #6366f1, absolute-galочка
 *     в правом-верхнем и полупрозрачный SVG робота в правом-нижнем
 *     (макет 1340–1347); тело — overview7 из фикстур.
 *  4. SectionHeader «РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ» (макет 1348).
 *  5–7. Три action-карточки GlassCard rounded 18 (макет 1349–1351): Aa/√x/ручка
 *     с уводом на d11 (детали предмета) — все три ассоциированы с subject_id.
 *  8. SectionHeader «ПРОГРЕСС ПО ПРЕДМЕТАМ» (макет 1352).
 *  9–14. Единый glass-контейнер r20 с 5-ю строками (макет 1353–1358):
 *     prog 98%, math 96%, robo 94%, eng 88%, rus 84% — данные из SUBJECT_STATS
 *     (порядок задан макетом, не совпадает с порядком массива).
 *  15. Ссылка «Смотреть детальную статистику ›» → таб p10 (Оценки), макет 1360.
 *
 * Данные — через аксессоры src/data:
 *  - getAssistantScreen(childId) — тексты + subject_progress;
 *  - getSubject(key) — предметы для подписи «Программир./Математика/…».
 * Тексты хрома — d.parentApp.* (RU/UZ/EN). Обе темы — useTheme().
 *
 * Правила заказчика: НЕТ «Кружков», прогресс-список — 5 предметов из макета.
 */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { AccentCard, GlassCard, InnerHeader, SectionHeader } from "../../ui";
import { getAssistantScreen } from "../../data";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

// ─────────────────────────────────────────────────────────────────────────────
// Мелкие вспомогательные фрагменты (только для этого экрана).
// ─────────────────────────────────────────────────────────────────────────────

/** Круглый AI-бейдж 38 (правый слот шапки, макет 1337). */
function AiHeaderBadge() {
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        overflow: "hidden",
        ...shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" }),
      }}
    >
      <LinearGradient
        colors={["#7c3aed", "#4f6df5"]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#FFFFFF" }}>
          AI
        </Text>
      </View>
    </View>
  );
}

/** Chevron ›, 14px stroke 2.2 (макет 1349–1351, ICONS.chevron-right). */
function Chevron() {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(26,19,74,0.4)"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

/** Иконка-плитка 36×36 rounded 12 с градиентом (action-cards, макет 1349–1351).
 *  Внутри — либо текстовый глиф (Aa/√x), либо белый SVG-контур. */
function ActionTile({
  gradient,
  shadowRgb,
  glyph,
  svgPaths,
}: {
  gradient: [string, string];
  shadowRgb: string;
  glyph?: string;
  svgPaths?: string[];
}) {
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        overflow: "hidden",
        ...shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${shadowRgb},0.28)` }),
      }}
    >
      <LinearGradient
        colors={gradient}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {svgPaths ? (
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {svgPaths.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </Svg>
        ) : (
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
            {glyph}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Иконка-плитка 28×28 rounded 9 (progress-list, макет 1354–1358). */
function ProgressTile({
  gradient,
  glyph,
  svgPaths,
}: {
  gradient: [string, string];
  glyph?: string;
  svgPaths?: string[];
}) {
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 9,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={gradient}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {svgPaths ? (
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {svgPaths.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </Svg>
        ) : (
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "#FFFFFF" }}>
            {glyph}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Progress-bar height 5.5, r3, фон rgba(23,18,67,.09), заполнение — градиент. */
function ProgressBar({ pct, gradient }: { pct: number; gradient: [string, string] }) {
  const g = gradPoints(90);
  const width = Math.max(0, Math.min(100, pct));
  return (
    <View
      style={{
        flex: 1,
        height: 5.5,
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: "rgba(23,18,67,0.09)",
      }}
    >
      <View style={{ width: `${width}%`, height: "100%", overflow: "hidden", borderRadius: 3 }}>
        <LinearGradient
          colors={gradient}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Экран.
// ─────────────────────────────────────────────────────────────────────────────

/** Строки прогресса — порядок и градиенты ИЗ МАКЕТА (1354–1358), значения
 *  pct читаются из SUBJECT_STATS через getSubject.subject_id. */
type ProgressRowSpec = {
  key: "prog" | "math" | "robo" | "eng" | "rus";
  label: string;
  gradient: [string, string];
  glyph?: string;
  svgPaths?: string[];
  pct: number;
};

/** SVG-глифы 24×24 (белый контур), взятые дословно из макета. */
const GLYPHS = {
  /** Программирование «</>» (макет 1354). */
  code: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  /** Робот (макет 1356). */
  robot: [
    "M4 12a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z",
    "M12 8V4",
    "M9 14v1",
    "M15 14v1",
  ],
  /** Ручка/карандаш (макет 1351, 1358). */
  pen: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
} as const;

/** Декоративный робот в правом-нижнем углу карточки инсайта (макет 1342). */
function InsightRobotDeco() {
  return (
    <Svg
      style={{ position: "absolute", bottom: 10, right: 12, opacity: 0.5 }}
      width={52}
      height={52}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 8h16v12H4z" />
      <Path d="M4 12a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
      <Path d="M12 8V4" />
      <Path d="M9 14v1" />
      <Path d="M15 14v1" />
    </Svg>
  );
}

/** Кружок с галочкой в правом-верхнем углу карточки инсайта (макет 1341). */
function InsightCheckDeco() {
  return (
    <View
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.25)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.45)",
      }}
    >
      <Svg
        width={11}
        height={11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M20 6 9 17l-5-5" />
      </Svg>
    </View>
  );
}

export default function EduosAssistantScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const assistant = getAssistantScreen();

  // Спеки трёх action-карточек (макет 1349–1351): id используется для перехода
  // на d11 (детали предмета). Здесь три subject_id — eng, math, rus.
  const ACTIONS: {
    subject_id: "eng" | "math" | "rus";
    title: string;
    text: string;
    gradient: [string, string];
    shadowRgb: string;
    glyph?: string;
    svgPaths?: string[];
  }[] = [
    {
      subject_id: "eng",
      title: assistant.actions[0].title,
      text: assistant.actions[0].text,
      gradient: ["#f472b6", "#db2777"],
      shadowRgb: "219,39,119",
      glyph: "Aa",
    },
    {
      subject_id: "math",
      title: assistant.actions[1].title,
      text: assistant.actions[1].text,
      gradient: ["#facc15", "#ca8a04"],
      shadowRgb: "202,138,4",
      glyph: "√x",
    },
    {
      subject_id: "rus",
      title: assistant.actions[2].title,
      text: assistant.actions[2].text,
      gradient: ["#e879f9", "#a21caf"],
      shadowRgb: "162,28,175",
      svgPaths: [...GLYPHS.pen],
    },
  ];

  // Порядок и цвета строк — из макета (1354–1358). Значения pct — из фикстур.
  const PROGRESS_ROWS: ProgressRowSpec[] = [
    {
      key: "prog",
      label: "Программир.",
      gradient: ["#38bdf8", "#0284c7"],
      svgPaths: [...GLYPHS.code],
      pct: assistant.subject_progress.find((s) => s.subject_id === "prog")?.pct ?? 98,
    },
    {
      key: "math",
      label: d.parentApp.subj.math,
      gradient: ["#facc15", "#ca8a04"],
      glyph: "√x",
      pct: assistant.subject_progress.find((s) => s.subject_id === "math")?.pct ?? 96,
    },
    {
      key: "robo",
      label: d.parentApp.subj.robo,
      gradient: ["#2dd4bf", "#0d9488"],
      svgPaths: [...GLYPHS.robot],
      pct: assistant.subject_progress.find((s) => s.subject_id === "robo")?.pct ?? 94,
    },
    {
      key: "eng",
      label: d.parentApp.subj.eng.replace("язык", "яз."),
      gradient: ["#f472b6", "#db2777"],
      glyph: "Aa",
      pct: assistant.subject_progress.find((s) => s.subject_id === "eng")?.pct ?? 88,
    },
    {
      key: "rus",
      label: d.parentApp.subj.rus,
      gradient: ["#e879f9", "#a21caf"],
      svgPaths: [...GLYPHS.pen],
      pct: assistant.subject_progress.find((s) => s.subject_id === "rus")?.pct ?? 84,
    },
  ];

  // Divider-линия строк progress-list — та же семья цветов, что и action-cards
  // (макет 1355–1358: border-top rgba(23,18,67,.07); в тёмной — светлый пар).
  const rowDivider =
    scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.07)";

  return (
    <AppBackground>
      {/* Блок 1 — шапка (макет 1334–1338). */}
      <InnerHeader
        title="EduOS Assistant"
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={<AiHeaderBadge />}
      />

      {/* Блок 2 — скролл-контейнер (макет 1339). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* Блок 3 — AI Overall Insight card (макет 1340–1347). */}
        <AccentCard
          gradient={["#8b5cf6", "#6366f1"]}
          angle={135}
          shadowRgb="99,102,241"
          radius={22}
          contentStyle={{ padding: 15, gap: 6 }}
        >
          <InsightCheckDeco />
          <InsightRobotDeco />
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 8.5,
              letterSpacing: 8.5 * 0.08,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {d.parentApp.ai.overall}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 10,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            За последние 7 дней
          </Text>
          <Text
            style={{
              fontFamily: fonts.unbounded600,
              fontSize: 17,
              color: "#FFFFFF",
            }}
          >
            Хороший прогресс!
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11,
              lineHeight: 11 * 1.55,
              color: "rgba(255,255,255,0.92)",
              maxWidth: 250,
            }}
          >
            {assistant.overview_text}
          </Text>
        </AccentCard>

        {/* Блок 4 — заголовок «РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ» (макет 1348). */}
        <SectionHeader title="РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ" />

        {/* Блоки 5–7 — action-cards (макет 1349–1351). */}
        {ACTIONS.map((a) => (
          <GlassCard
            key={a.subject_id}
            radius={18}
            contentStyle={{
              paddingVertical: 12,
              paddingHorizontal: 13,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 11,
            }}
            onPress={() => navigation.navigate("d11")}
          >
            <ActionTile
              gradient={a.gradient}
              shadowRgb={a.shadowRgb}
              glyph={a.glyph}
              svgPaths={a.svgPaths}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12,
                  color: tokens.ink1,
                }}
              >
                {a.title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 10,
                  lineHeight: 10 * 1.45,
                  color: tokens.ink2,
                }}
              >
                {a.text}
              </Text>
            </View>
            <View style={{ paddingTop: 2 }}>
              <Chevron />
            </View>
          </GlassCard>
        ))}

        {/* Блок 8 — заголовок «ПРОГРЕСС ПО ПРЕДМЕТАМ» (макет 1352). */}
        <SectionHeader title="ПРОГРЕСС ПО ПРЕДМЕТАМ" />

        {/* Блоки 9–14 — единый glass-контейнер r20 с 5-ю строками
            (макет 1353–1358). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 6, paddingHorizontal: 14 }}>
          {PROGRESS_ROWS.map((row, idx) => (
            <View
              key={row.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                paddingVertical: 8,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: rowDivider,
              }}
            >
              <ProgressTile
                gradient={row.gradient}
                glyph={row.glyph}
                svgPaths={row.svgPaths}
              />
              <Text
                numberOfLines={1}
                style={{
                  width: 104,
                  fontFamily: fonts.manrope700,
                  fontSize: 11,
                  color: tokens.ink1,
                }}
              >
                {row.label}
              </Text>
              <ProgressBar pct={row.pct} gradient={row.gradient} />
              <Text
                style={{
                  width: 34,
                  textAlign: "right",
                  fontFamily: fonts.manrope800,
                  fontSize: 11.5,
                  color: tokens.ink1,
                }}
              >
                {row.pct}%
              </Text>
            </View>
          ))}
        </GlassCard>

        {/* Блок 15 — ссылка «Смотреть детальную статистику ›» (макет 1360).
            Уход на таб p10 (Оценки/Успехи). */}
        <Text
          onPress={() => navigation.navigate("p10")}
          style={{
            textAlign: "center",
            fontFamily: fonts.manrope800,
            fontSize: 11.5,
            color: tokens.status.violet.text,
          }}
        >
          {assistant.details_link_label}
        </Text>
      </ScrollView>
    </AppBackground>
  );
}
