/**
 * dtests «Тесты» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: список `TESTS` из фикстуры с придуманными процентами, обратным
 * отсчётом до «предстоящих» тестов и переходом на «Разбор ответов».
 *
 * СТАЛО: `getChildTests` из @snr/core — таблица `test_submissions` ребёнка,
 * тот же запрос, что питает «Тесты» на вебе. Название и предмет приходят из
 * связанного задания (своих колонок у сдачи нет).
 *
 * ЧЕГО НЕТ И ПОЧЕМУ:
 *  • вкладки «Пройденные / Предстоящие». В базе есть только СДАННЫЕ работы;
 *    «предстоящий тест» пришлось бы вычислять из заданий, у которых нет
 *    сдачи, — а такой список уже есть на экране домашних заданий, и второй
 *    его вид расходился бы с первым. Осталось то, что экран знает точно.
 *  • переход в «Разбор ответов»: в `test_submissions` лежат только итоги —
 *    баллы, максимум и оценка. Самих ответов ученика в таблице нет, и
 *    рисовать пустой разбор было бы обманом. Строка не кликается.
 *
 * Донат в шапке считает средний ПРОЦЕНТ по сданным работам (score/max_score),
 * а не выдуманный «pct» фикстуры; рядом — число работ и средний балл.
 */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { format, getChildTests, LOCALE_TAG, averageOf, testGrade5, type ChildTestItem } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { Ring } from "../../ui/charts";
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
  SectionHeader,
  StatusChip,
} from "../../ui";
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { dayMonth } from "../../lib/dateLabels";
import { tashkentDateKey } from "../../lib/tashkent";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Доля правильных ответов в процентах — или null, если работа не проверена. */
function percentOf(t: ChildTestItem): number | null {
  if (t.score == null || t.maxScore == null || t.maxScore <= 0) return null;
  return Math.round((t.score / t.maxScore) * 100);
}

/** Цвет чипа результата: та же шкала, что на вебе (85 / 60). */
function resultFamily(pct: number | null): "green" | "orange" | "red" | "gray" {
  if (pct == null) return "gray";
  if (pct >= 85) return "green";
  if (pct >= 60) return "orange";
  return "red";
}

/** Иконка-плитка строки теста: галочка для проверенной работы, лист — нет. */
function TestIconTile({ graded }: { graded: boolean }) {
  const paths = graded
    ? ["M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z", "m8.5 12 2.5 2.5 5-5"]
    : ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5", "M9 13h6", "M9 17h4"];
  const gradient: [string, string] = graded ? ["#34d399", "#059669"] : ["#94a3b8", "#64748b"];
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={[
        { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
        shadowStyle({ x: 0, y: 6, blur: 12, color: `${gradient[1]}44` }),
      ]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) => (
          <Path key={i} d={p} />
        ))}
      </Svg>
    </LinearGradient>
  );
}

export default function TestsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m = t.more;
  const m4 = t.more4;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();

  const { childId, child, pickerItems, selectChild, loading: childLoading } = useChildScope();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useChildQuery(childId, (db, id) => getChildTests(db, id));
  const tests = state.data ?? [];

  // 25.08.2026, заход 2 — сдача без выставленной оценки больше не выпадает
  // из счёта: для неё подставляется доля правильных ответов. Нормировка общая
  // (testGrade5), та же, что у учителя, ученика и на вебе.
  const gradedValues = tests
    .map((x) => testGrade5({ grade: x.grade, score: x.score, max_score: x.maxScore }))
    .filter((v): v is number => v != null);
  const avgMean = averageOf(gradedValues);
  const avgGrade = avgMean != null ? avgMean.toFixed(1) : "—";
  const pcts = tests.map(percentOf).filter((p): p is number => p != null);
  const donutPct = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;

  const goHelp = () => navigation.navigate("stub", { stubKey: "help" });

  return (
    <AppBackground>
      <InnerHeader
        title={t.svc.tests}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={goHelp}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M3 6h18" />
              <Path d="M7 12h10" />
              <Path d="M10 18h4" />
            </Svg>
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
            onPress={() => setSheetOpen(true)}
          />
        ) : null}

        {/* Шапка: средний результат в кольце + число работ и средний балл. */}
        <View
          style={[
            { position: "relative", flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, overflow: "hidden" },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(99,102,241,0.35)" }),
          ]}
        >
          <LinearGradient colors={["#38bdf8", "#6366f1"]} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.35)" }} />

          <Ring
            size={70}
            viewBoxSize={88}
            r={32}
            thickness={9}
            value={donutPct}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.3)"
            centerContent={
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>{`${donutPct}%`}</Text>
            }
          />

          <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
                {m4.testsPassed}
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>{tests.length}</Text>
            </View>

            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />

            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
                {m4.testsAvgGrade}
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>{avgGrade}</Text>
            </View>
          </View>
        </View>

        {childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : tests.length === 0 ? (
          <EmptyBlock
            title={m.testsEmptyTitle}
            text={format(m.testsEmptyText, { name: child?.first_name ?? "" })}
          />
        ) : (
          <>
            <SectionHeader title={format(m.testsCount, { n: String(tests.length) })} />
            {tests.map((row) => {
              const pct = percentOf(row);
              const isGraded = pct != null;
              return (
                <GlassCard
                  key={row.id}
                  radius={18}
                  contentStyle={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}
                >
                  <TestIconTile graded={isGraded} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                      {row.title}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}>
                      {[row.subjectName, row.submittedAt ? dayMonth(tashkentDateKey(row.submittedAt), localeTag) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {row.grade != null ? (
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>
                        {format(m.testsGrade, { grade: String(row.grade) })}
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip
                    label={
                      isGraded
                        ? format(m.testsScore, { score: String(row.score), max: String(row.maxScore) })
                        : m.testsNotGraded
                    }
                    family={resultFamily(pct)}
                  />
                </GlassCard>
              );
            })}
          </>
        )}
      </ScrollView>

      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={childId ?? undefined}
          onSelect={(id) => {
            selectChild(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}
