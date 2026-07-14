/* TODO(child-skills-schema): нет таблицы skills/child_skills в БД (подтверждено
 * аудитом Промта МОБ-3 — ни одной таблицы с 'skill' в имени). Все значения на
 * этом экране ниже, кроме мини-карточки ребёнка (она реальная, из
 * ParentDataContext), взяты из ../lib/mockSkills — детерминированный mock по
 * studentId. Заменить getMockSkills/getMockSkillsOverallIndex на реальный
 * запрос, когда появится схема навыков. */
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path, Polygon } from "react-native-svg";
import { useAppLocale } from "../i18n";
import { useParentData } from "../context/ParentDataContext";
import { EmptyState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import { getMockSkills, getMockSkillsOverallIndex, type MockSkill } from "../lib/mockSkills";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

// Геометрия радара: шестиугольник, центр (120,95), внешний радиус 75 — те же
// числа, что и viewBox="0 0 240 190" в прототипе Claude Design. Координаты
// считаются тригонометрией (не захардкожены), первая ось смотрит вверх (-90°)
// и далее по часовой стрелке с шагом 60°.
const RADAR_CX = 120;
const RADAR_CY = 95;
const RADAR_R = 75;
const RADAR_RINGS = [0.25, 0.5, 0.75, 1];
const RADAR_LABEL_R = 1.24; // подписи чуть за пределами внешнего кольца

function axisPoint(index: number, fraction: number) {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  return {
    x: RADAR_CX + Math.cos(angle) * RADAR_R * fraction,
    y: RADAR_CY + Math.sin(angle) * RADAR_R * fraction,
  };
}

// Та же техника арки-спидометра, что и в прототипе (#11/#16): путь
// "M12 58 A48 48 0 0 1 108 58" внутри viewBox 120×66, длина ~150.8 —
// дуга на 180°, stroke-dasharray = длина_заполненной_части / полная_длина.
const ARC_PATH = "M12 58 A48 48 0 0 1 108 58";
const ARC_TOTAL_LENGTH = 150.8;

export default function SkillsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "Skills">>();
  const { childId } = route.params;

  // Как и другие детальные экраны Промта МОБ-3 (SubjectDetail/AttendanceDetail),
  // не полагаемся на contextual selectedChildId — родитель мог переключить
  // ребёнка между открытием списка и просмотром этого экрана. Ищем ребёнка по
  // явному childId из route.params в уже загрученном ParentDataContext.
  const { data: parentCtx } = useParentData();
  const child = parentCtx?.children.find((c) => c.id === childId) ?? null;

  const skills = useMemo(() => getMockSkills(childId), [childId]);
  const overallIndex = useMemo(() => getMockSkillsOverallIndex(childId), [childId]);

  const radarRings = useMemo(
    () =>
      RADAR_RINGS.map((fraction) =>
        Array.from({ length: 6 }, (_, i) => axisPoint(i, fraction))
          .map((p) => `${p.x},${p.y}`)
          .join(" "),
      ),
    [],
  );
  const radarAxes = useMemo(() => Array.from({ length: 6 }, (_, i) => axisPoint(i, 1)), []);
  const radarPoly = useMemo(
    () =>
      skills
        .map((s, i) => {
          const p = axisPoint(i, s.value / 100);
          return `${p.x},${p.y}`;
        })
        .join(" "),
    [skills],
  );
  const radarDots = useMemo(() => skills.map((s, i) => axisPoint(i, s.value / 100)), [skills]);
  const radarLabels = useMemo(
    () => skills.map((s, i) => ({ ...axisPoint(i, RADAR_LABEL_R), skill: s })),
    [skills],
  );

  const arcFraction = Math.max(0, Math.min(1, overallIndex / 5));
  const arcDash = `${(ARC_TOTAL_LENGTH * arcFraction).toFixed(1)} ${ARC_TOTAL_LENGTH}`;

  // Активности тематически привязаны к соответствующим mock-навыкам — берём
  // их цвет/фон из getMockSkills вместо изобретения новых hex-цветов вне theme.ts.
  const communicationSkill = skills.find((s) => s.nameKey === "skillCommunication");
  const teamworkSkill = skills.find((s) => s.nameKey === "skillTeamwork");
  const activities: Array<{ icon: keyof typeof Ionicons.glyphMap; skill: MockSkill | undefined; title: string; desc: string }> = [
    { icon: "chatbubbles-outline", skill: communicationSkill, title: d.parentMobile.skillsActivity1Title, desc: d.parentMobile.skillsActivity1Desc },
    { icon: "people-outline", skill: teamworkSkill, title: d.parentMobile.skillsActivity2Title, desc: d.parentMobile.skillsActivity2Desc },
  ];

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <Pressable
        onPress={() => nav.goBack()}
        style={({ pressed }) => [{
          width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff",
          alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...shadow.soft,
        }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </Pressable>
      <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
        {d.parentMobile.skillsTitle}
      </Text>
      <View style={{ width: 38 }} />
    </View>
  );

  if (!child) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View style={{ padding: spacing.lg, paddingBottom: 0 }}>{header}</View>
          <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          {header}

          {/* Мини-карточка ребёнка — реальные данные из ParentDataContext */}
          <View
            style={{
              backgroundColor: colors.card, borderRadius: radii.lg, padding: 10, paddingHorizontal: 13,
              flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, ...shadow.soft,
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>{initials(child.fullName)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{child.fullName}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted }}>{child.className ?? d.common.none}</Text>
            </View>
          </View>

          {/* Hero: общий индекс развития + арка-спидометр */}
          <LinearGradient
            colors={gradients.tealCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radii.xxl, padding: 16, marginBottom: 16,
              flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden", ...shadow.card,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 5 }}>
                {d.parentMobile.skillsOverallIndexLabel}
              </Text>
              <Text style={{ fontSize: 33, fontWeight: "800", color: "#fff", letterSpacing: -0.5 }}>
                {overallIndex.toFixed(1)}
                <Text style={{ fontSize: 15, fontWeight: "600", opacity: 0.75 }}>/5.0</Text>
              </Text>
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#fff", opacity: 0.92, marginTop: 6 }}>
                {d.parentMobile.skillsOverallRatingGreat}
              </Text>
            </View>
            <View style={{ width: 112, height: 62 }}>
              <Svg width={112} height={62} viewBox="0 0 120 66">
                <Path d={ARC_PATH} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={10} strokeLinecap="round" />
                <Path d={ARC_PATH} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeDasharray={arcDash} />
              </Svg>
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }}>
                <Ionicons name="star" size={14} color="#fff" />
              </View>
            </View>
          </LinearGradient>

          {/* Радар-диаграмма навыков */}
          <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingTop: 14, paddingHorizontal: 10, paddingBottom: 8, marginBottom: 14, ...shadow.soft }}>
            <View style={{ width: 240, height: 190, alignSelf: "center" }}>
              <Svg width={240} height={190} viewBox="0 0 240 190">
                {radarRings.map((pts, i) => (
                  <Polygon key={i} points={pts} fill="none" stroke="#E8EAF3" strokeWidth={1} />
                ))}
                {radarAxes.map((p, i) => (
                  <Line key={i} x1={RADAR_CX} y1={RADAR_CY} x2={p.x} y2={p.y} stroke="#EEF0F7" strokeWidth={1} />
                ))}
                <Polygon points={radarPoly} fill="rgba(155,126,247,0.32)" stroke={colors.primaryLight} strokeWidth={2} />
                {radarDots.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.primary} stroke="#fff" strokeWidth={1.5} />
                ))}
              </Svg>
              {radarLabels.map((rl, i) => (
                <View key={i} style={{ position: "absolute", left: rl.x - 30, top: rl.y - 12, width: 60, alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: "600", color: colors.textSecondary }}>
                    {d.parentMobile[rl.skill.nameKey]}
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: "800", color: colors.textPrimary }}>{rl.skill.value}%</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Сетка 3×2 из плашек навыков */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {skills.map((s) => (
              <View
                key={s.key}
                style={{
                  width: "31.5%", backgroundColor: colors.card, borderRadius: radii.md, padding: 10,
                  flexDirection: "row", alignItems: "center", gap: 8, ...shadow.soft,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={s.icon} size={14} color={s.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 8.5, fontWeight: "600", color: colors.textMuted }}>
                    {d.parentMobile[s.nameKey]}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary }}>{s.value}%</Text>
                </View>
              </View>
            ))}
          </View>

          {/* TODO(ai-skills-insight): заменить mock-текст на реальный AI-анализ, когда появится источник данных */}
          <View
            style={{
              borderRadius: radii.lg, marginBottom: 14, overflow: "hidden",
              borderWidth: 1, borderColor: colors.borderAlt,
            }}
          >
            <LinearGradient
              colors={gradients.soft}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 13, paddingHorizontal: 14, flexDirection: "row", gap: 11 }}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="sparkles" size={15} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "800", color: colors.primary, marginBottom: 3 }}>
                  {d.parentMobile.skillsAiInsightTitle}
                </Text>
                <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.textSecondary }}>
                  {d.parentMobile.skillsAiInsightMock}
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* TODO(child-skills-schema): "Рекомендуемые активности" — 2 статичных
              mock-элемента (см. TODO в шапке файла), без onPress — как и весь
              остальной контент на этом экране, заменить при появлении реальной
              схемы навыков. */}
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 }}>
            {d.parentMobile.skillsActivitiesTitle}
          </Text>
          {activities.map((a, i) => (
            <View
              key={i}
              style={{
                backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, paddingHorizontal: 14,
                flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 9, ...shadow.soft,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: a.skill?.bg ?? colors.chipBg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={a.icon} size={19} color={a.skill?.color ?? colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary }}>{a.title}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{a.desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
