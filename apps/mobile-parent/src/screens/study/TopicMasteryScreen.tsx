/**
 * dtopics «Освоение тем» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: 20 тем из фикстуры `TOPICS` с готовыми процентами, чипы по пяти
 * прибитым предметам и сортировка по выдуманным полям.
 *
 * СТАЛО: `getChildTopicMastery` из @snr/core — тот же расчёт, что питает
 * «Освоение тем» на вебе. Тема — это тема проведённого урока
 * (`lessons.topic`), а освоение темы — средний балл ребёнка за уроки этой
 * темы, приведённый к процентам. Ровно та же формула, что у
 * `getChildSubjectDetail` для одного предмета; здесь снято ограничение на
 * один предмет.
 *
 * ЧЕМ ЭТО НЕ ЯВЛЯЕТСЯ. В базе есть вторая, непохожая величина —
 * `lesson_stage_progress`: отметки о прохождении ЭТАПОВ урока. У демо-ребёнка
 * их ноль, и экран на ней показал бы честный ноль там, где у ребёнка есть 19
 * оценок. Поэтому считаем по оценкам, а внизу экрана прямо написано, из чего
 * складывается процент, — числа выведенные, и читатель должен видеть формулу.
 *
 * Чипы предметов строятся по тем предметам, которые реально встретились в
 * темах ребёнка. Сортировка осталась (это чистый вид), но её варианты
 * привязаны к настоящим полям: процент и название.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { format, getChildTopicMastery, type TopicMasteryItem } from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
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
  ProgressBar,
  Ring,
  StatusChip,
} from "../../ui";
import { useChildQuery } from "../../hooks/useChildScope";
import { useShowcaseChild } from "../../hooks/useShowcaseChild";
import { getSubject, getTopicMastery } from "../../data";
import type { BaseSubjectKey } from "../../data";
import { hexToRgbCsv } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Порог «освоено» — тот же, что на вебе. */
const MASTERED_AT = 70;

type SortKey = "pct_desc" | "pct_asc" | "title";

function SortFilterIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M3 6h18" />
      <Path d="M7 12h10" />
      <Path d="M10 18h4" />
    </Svg>
  );
}

export default function TopicMasteryScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m2 = t.more2;
  const m4 = t.more4;
  const navigation = useNavigation<Nav>();

  const sc = t.showcase;
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("pct_desc");
  // Фильтр витрины отдельный: у настоящей ветки он по названию предмета, а
  // здесь по ключу заготовки. Одно поле на оба смысла рано или поздно
  // разъехалось бы.
  const [showcaseFilter, setShowcaseFilter] = useState<BaseSubjectKey | null>(null);

  const state = useChildQuery(realChildId, (db, id) => getChildTopicMastery(db, id));

  // Витрина. Числа шапки считает аксессор по самим темам — в макете там
  // стоял статический текст, и он расходился со списком (см. журнал).
  const витрина = getTopicMastery(locale, showcaseFilter);
  const topics = useMemo(() => state.data ?? [], [state.data]);

  const subjects = useMemo(
    () => [...new Set(topics.map((x) => x.subjectName))].sort((a, b) => a.localeCompare(b)),
    [topics],
  );

  const masteredCount = topics.filter((x) => x.pct >= MASTERED_AT).length;
  const attentionCount = topics.length - masteredCount;
  const overallPct = topics.length > 0 ? Math.round(topics.reduce((s, x) => s + x.pct, 0) / topics.length) : 0;

  const visible = useMemo<TopicMasteryItem[]>(() => {
    const filtered = subjectFilter ? topics.filter((x) => x.subjectName === subjectFilter) : topics;
    const sorted = filtered.slice();
    if (sortKey === "pct_desc") sorted.sort((a, b) => b.pct - a.pct || a.topic.localeCompare(b.topic));
    else if (sortKey === "pct_asc") sorted.sort((a, b) => a.pct - b.pct || a.topic.localeCompare(b.topic));
    else sorted.sort((a, b) => a.topic.localeCompare(b.topic));
    return sorted;
  }, [topics, subjectFilter, sortKey]);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "pct_desc", label: m4.sortPctDesc },
    { key: "pct_asc", label: m4.sortPctAsc },
    { key: "title", label: m4.sortByTitle },
  ];

  function TopChip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
    const activeColor = color ?? tokens.accent;
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: 7,
          paddingHorizontal: 13,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? activeColor : tokens.glassBorder,
          backgroundColor: active ? activeColor : "rgba(255,255,255,0.55)",
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: active ? "#FFFFFF" : tokens.ink1 }}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <AppBackground>
      <InnerHeader
        title={t.scr.topics}
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
            {/* Чипы предметов: «Все» + пять предметов, порядок как в макете. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
              <TopChip label={sc.allChip} active={showcaseFilter === null} onPress={() => setShowcaseFilter(null)} />
              {витрина.subject_order.map((key) => (
                <TopChip
                  key={key}
                  label={getSubject(key).name}
                  active={showcaseFilter === key}
                  color={getSubject(key).color}
                  onPress={() => setShowcaseFilter(key)}
                />
              ))}
            </ScrollView>

            {/* Кольцо и три числа — всё посчитано по темам ниже. */}
            <GlassCard radius={22} contentStyle={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Ring
                size={76}
                viewBoxSize={88}
                r={32}
                thickness={9}
                value={витрина.overall_pct}
                color={tokens.accent}
                trackColor="rgba(124,58,237,0.16)"
                centerContent={
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, color: tokens.ink1 }}>
                    {`${витрина.overall_pct}%`}
                  </Text>
                }
              />
              <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                {[
                  format(sc.topicsInPlan, { n: String(витрина.total) }),
                  format(sc.topicsMastered, { n: String(витрина.mastered) }),
                  format(sc.topicsNeedAttention, { n: String(витрина.need_attention) }),
                ].map((line) => (
                  <Text key={line} style={{ fontFamily: fonts.manrope600, fontSize: 10.5, lineHeight: 15, color: tokens.ink2 }}>
                    {line}
                  </Text>
                ))}
              </View>
            </GlassCard>

            {/* Список: заголовок предмета, под ним его темы. */}
            {витрина.groups.map((g) => {
              const sb = getSubject(g.subject_id);
              return (
                <View key={g.subject_id} style={{ gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 10.5,
                      letterSpacing: 10.5 * 0.08,
                      color: tokens.ink3,
                      paddingHorizontal: 2,
                    }}
                  >
                    {sb.name.toUpperCase()}
                  </Text>
                  {g.rows.map((row) => {
                    const мало = row.mastery_pct < витрина.mastered_at;
                    return (
                      <GlassCard
                        key={row.title}
                        radius={18}
                        contentStyle={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
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
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                              {row.title}
                            </Text>
                            {мало ? <StatusChip label={sc.needsAttention} family="orange" /> : null}
                          </View>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                            {row.meta_label}
                          </Text>
                          <ProgressBar pct={row.mastery_pct / 100} height={5} fillGradient={sb.gradient} />
                        </View>
                        <Text
                          style={{
                            fontFamily: fonts.manrope800,
                            fontSize: 12,
                            minWidth: 36,
                            textAlign: "right",
                            color: мало ? tokens.status.orange.text : tokens.ink1,
                          }}
                        >
                          {`${row.mastery_pct}%`}
                        </Text>
                      </GlassCard>
                    );
                  })}
                </View>
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
        ) : topics.length === 0 ? (
          <EmptyBlock
            title={m2.topicsEmptyTitle}
            text={format(m2.topicsEmptyText, { name: child?.first_name ?? "" })}
          />
        ) : (
          <>
            {/* Чипы предметов — по тем, что реально встретились в темах. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
              <TopChip label={m2.topicsAllSubjects} active={subjectFilter === null} onPress={() => setSubjectFilter(null)} />
              {subjects.map((s) => (
                <TopChip
                  key={s}
                  label={s}
                  active={subjectFilter === s}
                  color={topics.find((x) => x.subjectName === s)?.subjectColor ?? undefined}
                  onPress={() => setSubjectFilter(s)}
                />
              ))}
            </ScrollView>

            {/* Итог: кольцо общего освоения + три числа. */}
            <GlassCard radius={22} contentStyle={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Ring
                size={76}
                viewBoxSize={88}
                r={32}
                thickness={9}
                value={overallPct}
                color={tokens.accent}
                trackColor="rgba(124,58,237,0.16)"
                centerContent={
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, color: tokens.ink1 }}>{`${overallPct}%`}</Text>
                }
              />
              <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                {[
                  { label: m2.topicsCount, value: topics.length, color: tokens.ink1 },
                  { label: m2.topicsMastered, value: masteredCount, color: tokens.status.green.text },
                  { label: m2.topicsAttention, value: attentionCount, color: tokens.status.orange.text },
                ].map((row) => (
                  <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
                      {row.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: row.color }}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>

            {/* Список тем. */}
            {visible.map((topic) => {
              const needsAttention = topic.pct < MASTERED_AT;
              const color = topic.subjectColor ?? tokens.accent;
              const pctColor = needsAttention ? tokens.status.orange.text : color;
              return (
                <GlassCard
                  key={`${topic.subjectName}::${topic.topic}`}
                  radius={18}
                  contentStyle={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, paddingHorizontal: 12 }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `rgba(${hexToRgbCsv(color)},0.15)`,
                      borderWidth: 1,
                      borderColor: `rgba(${hexToRgbCsv(color)},0.32)`,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color }}>
                      {topic.subjectName.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text numberOfLines={2} style={{ flexShrink: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                        {topic.topic}
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
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: tokens.status.orange.text }}>
                            {m2.topicsAttentionChip}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                      {`${topic.subjectName} · ${format(m2.topicsMeta, { n: String(topic.count), avg: topic.average.toFixed(1) })}`}
                    </Text>
                    <ProgressBar pct={topic.pct / 100} height={5.5} fillGradient={[color, color]} />
                  </View>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: pctColor, minWidth: 36, textAlign: "right" }}>
                    {`${topic.pct}%`}
                  </Text>
                </GlassCard>
              );
            })}

            {/* Из чего складывается процент — числа выведенные, формула на виду. */}
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9,
                lineHeight: 14,
                color: tokens.ink3,
                textAlign: "center",
                paddingHorizontal: 6,
                paddingTop: 2,
              }}
            >
              {m2.topicsNote}
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

      <BottomSheetFrame visible={sortOpen} onClose={() => setSortOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 18 }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1, paddingVertical: 10 }}>
            {m4.sortTitle}
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
                    <Path d="M20 6 9 17l-5-5" stroke={tokens.status.violet.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
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
