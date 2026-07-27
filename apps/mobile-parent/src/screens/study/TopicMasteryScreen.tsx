/**
 * TopicMastery (dtopics) — Заход 5.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1409–1428:
 *  1409–1414 HeaderBar (InnerHeader: круглая back-кнопка + заголовок
 *   scrTopics 15/600 + правая круглая glass-кнопка «фильтр/сортировка»
 *   с иконкой из трёх убывающих линий — открывает шит сортировки);
 *  1416 ChildSwitcherCard compact (glass r18, аватар 44, ФИО + класс);
 *  1417–1419 TopFilterChipsRow (горизонтальный скролл чипов «Все / <предмет>»);
 *  1420–1423 OverallProgressSummaryCard (glass-карточка: Ring 72×72 viewBox
 *   88, r 32, thickness 9, цвет #7C3AED + 3 строки статистики. Числа —
 *   агрегированы из TOPICS: total = 20, mastered = mastery_pct >= 70,
 *   attention = mastery_pct < 70, overall = средний mastery_pct);
 *  1424–1426 TopicList (список тем: SubjectTile 34, название + опциональный
 *   чип «Требует внимания» (когда mastery < 70), мета из TOPICS.meta_label,
 *   ProgressBar 5.5px с градиентом предмета, справа % в цвет предмета).
 *
 * Данные — через getTopics() / getSubject() из src/data; тексты — через
 * useAppLocale().d.parentApp.*. Тема обоих цветов — useTheme(); iOS
 * safe-area — из InnerHeader; ScrollView с paddingBottom 118 под таб-бар.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  Ring,
  ProgressBar,
  SubjectTile,
  type ChildPickerItem,
  type SubjectId,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getSelectedChildContext,
  getSubject,
  getTopics,
} from "../../data";
import type { BaseSubjectKey, TopicMasteryRow } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Глиф предмета (совпадает с ProgressScreen / SubjectDetail). */
const SUBJECT_GLYPH: Record<BaseSubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** Порог освоения из фикстур: <70% → чип «Требует внимания». */
const MASTERY_ATTENTION_THRESHOLD = 70;

/** Иконка «фильтр/сортировка» — три горизонтальные линии, убывающие по длине
 *  (макет строка 1413: 16×16, stroke 1.8, пути M3 6h18 / M7 12h10 / M10 18h4). */
function SortFilterIcon({ color }: { color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 6h18" />
      <Path d="M7 12h10" />
      <Path d="M10 18h4" />
    </Svg>
  );
}

/** Способы сортировки списка тем (лист сортировки открывается по правой
 *  кнопке шапки — экранный OTA-конфиг, а не поле фикстуры). */
type SortKey = "pct_desc" | "pct_asc" | "name";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "pct_desc", label: "По прогрессу (сначала выше)" },
  { key: "pct_asc", label: "По прогрессу (сначала ниже)" },
  { key: "name", label: "По названию (А–Я)" },
];

/** Порядок предметов в горизонтальном ряду чипов (левый — «Все»). */
const CHIP_SUBJECTS: BaseSubjectKey[] = ["math", "prog", "robo", "eng", "rus"];

export default function TopicMasteryScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const { currentChildId } = useAuthSession();

  const children = getChildren();
  const initialChildId =
    currentChildId ?? children[DEFAULT_CHILD_INDEX].id;
  const [childId, setChildId] = useState<string>(initialChildId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  /** null — «Все»; иначе конкретный предмет. */
  const [subjectFilter, setSubjectFilter] = useState<BaseSubjectKey | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("pct_desc");

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const allTopics = getTopics();
  const totalTopics = allTopics.length;
  const masteredCount = allTopics.filter(
    (t) => t.mastery_pct >= MASTERY_ATTENTION_THRESHOLD,
  ).length;
  const attentionCount = totalTopics - masteredCount;
  const overallPct = Math.round(
    allTopics.reduce((s, t) => s + t.mastery_pct, 0) / Math.max(totalTopics, 1),
  );

  const visibleTopics = useMemo<TopicMasteryRow[]>(() => {
    const filtered = subjectFilter
      ? allTopics.filter((t) => t.subject_id === subjectFilter)
      : allTopics.slice();
    const sorted = filtered.slice();
    if (sortKey === "pct_desc") sorted.sort((a, b) => b.mastery_pct - a.mastery_pct);
    else if (sortKey === "pct_asc") sorted.sort((a, b) => a.mastery_pct - b.mastery_pct);
    else sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    return sorted;
  }, [allTopics, subjectFilter, sortKey]);

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

  /** Чип-рендерер верхнего ряда фильтров (макет строки 1417–1419). */
  function TopChip({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active
            ? `rgba(${tokens.status.violet.rgb},0.4)`
            : tokens.glassBorder,
          backgroundColor: active
            ? `rgba(${tokens.status.violet.rgb},0.14)`
            : "rgba(255,255,255,0.55)",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 11,
            color: active ? tokens.status.violet.text : tokens.ink1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <AppBackground>
      {/* Блок 1 — HeaderBar. */}
      <InnerHeader
        title={d.parentApp.scr.topics}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => setSortOpen(true)}>
            <SortFilterIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* Блок 2 — ChildSwitcherCard. */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          onPress={() => setPickerOpen(true)}
        />

        {/* Блок 3 — TopFilterChipsRow (горизонт. скролл, макет 1417–1419). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
        >
          <TopChip
            active={subjectFilter === null}
            label="Все"
            onPress={() => setSubjectFilter(null)}
          />
          {CHIP_SUBJECTS.map((sk) => (
            <TopChip
              key={sk}
              active={subjectFilter === sk}
              label={getSubject(sk).name}
              onPress={() => setSubjectFilter(sk)}
            />
          ))}
        </ScrollView>

        {/* Блок 4 — OverallProgressSummaryCard (макет 1420–1423). */}
        <GlassCard
          radius={20}
          contentStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingVertical: 13,
            paddingHorizontal: 14,
          }}
        >
          <Ring
            value={overallPct}
            max={100}
            size={72}
            viewBoxSize={88}
            r={32}
            thickness={9}
            color={tokens.accent}
            centerContent={
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 15,
                  color: tokens.ink1,
                }}
              >
                {overallPct}%
              </Text>
            }
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 13,
                color: tokens.ink1,
              }}
            >
              {`${totalTopics} тем в учебном плане`}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 11,
                color: tokens.status.green.text,
              }}
            >
              {`${masteredCount} освоено на ${MASTERY_ATTENTION_THRESHOLD}% и выше`}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 10,
                color: tokens.ink3,
              }}
            >
              {`${attentionCount} тем требуют внимания — они помечены в списке`}
            </Text>
          </View>
        </GlassCard>

        {/* Блок 5 — TopicList (макет 1424–1426). */}
        {visibleTopics.map((topic, i) => {
          const subject = getSubject(topic.subject_id);
          const needsAttention = topic.mastery_pct < MASTERY_ATTENTION_THRESHOLD;
          const pctColor = needsAttention
            ? tokens.status.orange.text
            : subject.text_color;
          return (
            <GlassCard
              key={`${topic.subject_id}-${topic.title}-${i}`}
              radius={18}
              contentStyle={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingVertical: 11,
                paddingHorizontal: 12,
              }}
            >
              <SubjectTile
                subjectId={topic.subject_id as SubjectId}
                size={34}
                radius={11}
                glyph={SUBJECT_GLYPH[topic.subject_id]}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 12,
                      color: tokens.ink1,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {topic.title}
                  </Text>
                  {needsAttention ? (
                    <View
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        borderRadius: 999,
                        backgroundColor: `rgba(${tokens.status.orange.rgb},0.13)`,
                        borderWidth: 1,
                        borderColor: `rgba(${tokens.status.orange.rgb},0.33)`,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.manrope800,
                          fontSize: 9,
                          color: tokens.status.orange.text,
                        }}
                      >
                        Требует внимания
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 10,
                    color: tokens.ink3,
                  }}
                  numberOfLines={1}
                >
                  {`${subject.name} · ${topic.meta_label}`}
                </Text>
                <ProgressBar
                  pct={topic.mastery_pct / 100}
                  height={5.5}
                  fillGradient={subject.gradient}
                />
              </View>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12,
                  color: pctColor,
                  minWidth: 36,
                  textAlign: "right",
                }}
              >
                {`${topic.mastery_pct}%`}
              </Text>
            </GlassCard>
          );
        })}
      </ScrollView>

      {/* Шит выбора ребёнка (переключатель). */}
      <BottomSheetFrame visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <ChildPickerSheetContent
          title={d.parentApp.auth.chooseChild}
          items={pickerItems}
          selectedId={childId}
          onSelect={(id) => {
            setChildId(id);
            setPickerOpen(false);
          }}
        />
      </BottomSheetFrame>

      {/* Шит сортировки (открывает правая кнопка шапки). */}
      <BottomSheetFrame visible={sortOpen} onClose={() => setSortOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 18 }}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 14,
              color: tokens.ink1,
              paddingVertical: 10,
            }}
          >
            Сортировка
          </Text>
          {SORT_OPTIONS.map((opt, i) => {
            const active = sortKey === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSortKey(opt.key);
                  setSortOpen(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(23,18,67,0.07)",
                }}
              >
                <Text
                  style={{
                    fontFamily: active ? fonts.manrope800 : fonts.manrope700,
                    fontSize: 12,
                    color: active ? tokens.status.violet.text : tokens.ink1,
                  }}
                >
                  {opt.label}
                </Text>
                {active ? (
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6 9 17l-5-5"
                      stroke={tokens.status.violet.text}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetFrame>
    </AppBackground>
  );
}
