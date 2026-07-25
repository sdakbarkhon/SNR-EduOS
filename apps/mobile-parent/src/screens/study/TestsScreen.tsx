/**
 * Экран dtests «Тесты» — REBUILD (block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html» (блок data-screen-label="Тесты"):
 *  1.  HeaderBar: back-glass 38 (goBack) + title Unbounded 15/600 «Тесты»
 *      (t.svc.tests) + help-glass 38 справа (goHelp → stub «help»), три
 *      горизонтальные линии убывающей длины (paths «M3 6h18»/«M7 12h10»/
 *      «M10 18h4»). Реализовано через InnerHeader + GlassCircleButton (см.
 *      ServicesScreen.tsx).
 *  2.  ScrollView-тело: gap 11, padding 4/18/118 (литерал из блока —
 *      padding:4px 18px 118px).
 *  3.  ChildSwitcherCard compact — тот же паттерн, что и в
 *      ChildProfileScreen.tsx (Блок 2) + шторка выбора ребёнка внизу файла.
 *  4.  HeroStatsCard: непрозрачный градиент 135° #38bdf8→#6366f1,
 *      box-shadow 0 16 36 rgba(99,102,241,.35) + inset-блик hairline
 *      (rgba(255,255,255,.35), как в ChildProfileScreen HeroCard):
 *      4a. Ring-донат 70×70 (viewBox 88, r 32, thickness 9, color #fff,
 *          trackColor rgba(255,255,255,.3)) — центр-текст «{donutPct}%»;
 *          donutPct вычисляется (не хардкод) из среднего .pct пройденных
 *          тестов.
 *      4b. Колонка «ТЕСТОВ ПРОЙДЕНО» (8/800 upper W75) + значение doneCount
 *          (15/800 white) — литерал-подпись из макета, без i18n-биндинга.
 *      4c. Вертикальный разделитель 1px rgba(255,255,255,.25).
 *      4d. Колонка «СРЕДНИЙ БАЛЛ» (8/800 upper W75) + значение avgGrade
 *          (15/800 white, среднее .grade пройденных тестов, 1 знак после
 *          запятой) — литерал-подпись.
 *  5.  FilterPillsRow: 3 pill-таба «Все»/«Пройденные»/«Предстоящие»
 *      (литералы из макета, без i18n) — активный/неактивный стиль ДОСЛОВНО
 *      из TabsRow ChildProfileScreen.tsx (градиент 135° #7c3aed→#4f6df5 +
 *      тень rgba(124,58,237,.35) активный; glass W55/W08 + border W75/W14
 *      неактивный). Локальный state activeFilter фильтрует список тестов.
 *  6.  TestRowsList — sc-for testRows по filteredTests, каждая строка:
 *      GlassCard r18, padding 12/14, gap 12:
 *      6a. Иконка-плитка 36×36 r12, градиент getSubject(subject_id).gradient
 *          (135°) + цветная тень (тон второго стопа градиента, как
 *          SubjectTile.tsx), белый глиф — ICONS.check (пройден) /
 *          ICONS.doc (предстоит) из navigation/routes.ts (дословно по
 *          инструкции экрана).
 *      6b. Текстовая колонка: name (12/800 ink1), topic (10/600 ink2
 *          dimmed), date_label (9.5/700 ink3 more dimmed).
 *      6c. Правая пилюля: StatusChip family="green" c result_label
 *          (пройденные) / family="blue" c countdown_label (предстоящие) —
 *          цветовые семьи по прецеденту ScheduleScreen.tsx (grade-чип —
 *          green) и SubjectDetailScreen.tsx (countdown-чип — blue).
 *      6d. onPress строки → navigation.navigate("da1") (экран «Разбор
 *          ответов», заглушка-плейсхолдер в этом заходе).
 *  7.  BottomSheetFrame + ChildPickerSheetContent — шторка выбора ребёнка
 *      (открывается тапом по ChildSwitcherCard, блок 3).
 *
 * Данные — getTests()/getSubject() из "../../data" (только чтение, фикстуры
 * не трогаем). Дочерний контекст — getChildren()/getSelectedChildContext().
 * Тексты — d.parentApp.* где есть биндинг в макете; литералы-подписи секции
 * (ТЕСТОВ ПРОЙДЕНО/СРЕДНИЙ БАЛЛ/Все/Пройденные/Предстоящие) — как в макете,
 * без новых i18n-ключей (правило спец-контекста, прецедент — «Школа» в
 * ChildProfileScreen.tsx). Обе темы — useTheme().
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { Ring } from "../../ui/charts";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  StatusChip,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildren,
  getSelectedChildContext,
  getSubject,
  getTests,
} from "../../data";
import type { TestRow } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { ICONS } from "../../navigation/routes";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Ключи фильтра строки пилюль (макет: ttAll/ttDone/ttUp). */
type TestFilterKey = "all" | "done" | "upcoming";

/** #RRGGBB → «R,G,B» для rgba()-теней (тон = тёмный стоп градиента предмета). */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * Иконка-плитка строки теста (блок 6a) — 36×36 r12, градиент предмета
 * (getSubject().gradient) + цветная тень, белый глиф check/doc из ICONS.
 */
function TestIconTile({ subjectId, done }: { subjectId: TestRow["subject_id"]; done: boolean }) {
  const { tokens } = useTheme();
  const subject = getSubject(subjectId);
  const shadow = tokens.shColor(hexToRgb(subject.gradient[1]));
  const paths = done ? ICONS.check : ICONS.doc;

  return (
    <LinearGradient
      colors={subject.gradient}
      {...gradPoints(135)}
      style={[
        {
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        shadowStyle(shadow),
      ]}
    >
      <Svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((p, i) => (
          <Path key={i} d={p} />
        ))}
      </Svg>
    </LinearGradient>
  );
}

/** Одна строка списка тестов (блок 6). */
function TestRowCard({ row, onPress }: { row: TestRow; onPress: () => void }) {
  const { tokens } = useTheme();

  return (
    <GlassCard
      radius={18}
      onPress={onPress}
      contentStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <TestIconTile subjectId={row.subject_id} done={row.done} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}
        >
          {row.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}
        >
          {row.topic}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}
        >
          {row.date_label}
        </Text>
      </View>
      {row.done ? (
        <StatusChip label={row.result_label ?? ""} family="green" />
      ) : (
        <StatusChip label={row.countdown_label ?? ""} family="blue" />
      )}
    </GlassCard>
  );
}

export default function TestsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(
    () => session.currentChildId ?? children[0].id,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TestFilterKey>("all");

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const tests = getTests();
  const doneTests = tests.filter((row) => row.done);
  const doneCount = doneTests.length;
  const avgGrade = (
    doneTests.reduce((sum, row) => sum + (row.grade ?? 0), 0) / (doneTests.length || 1)
  ).toFixed(1);
  const donutPct = Math.round(
    doneTests.reduce((sum, row) => sum + (row.pct ?? 0), 0) / (doneTests.length || 1),
  );

  const filteredTests = tests.filter((row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "done") return row.done;
    return !row.done;
  });

  const pickerItems: ChildPickerItem[] = children.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${t.grades.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  const goHelp = () => navigation.navigate("stub", { stubKey: "help" });

  const inactiveTabTextColor = scheme === "light" ? "rgba(26,19,74,0.66)" : "rgba(255,255,255,0.7)";

  const filters: { key: TestFilterKey; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "done", label: "Пройденные" },
    { key: "upcoming", label: "Предстоящие" },
  ];

  return (
    <AppBackground>
      {/* Блок 1: Header (back + title + help). */}
      <InnerHeader
        title={t.svc.tests}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={goHelp}>
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.ink1}
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <Path d="M3 6h18" />
              <Path d="M7 12h10" />
              <Path d="M10 18h4" />
            </Svg>
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
        {/* Блок 3: ChildSwitcherCard compact — открывает шторку выбора ребёнка. */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${t.grades.class}`}
          switchLabel="Сменить ›"
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 4: HeroStatsCard — донат + «ТЕСТОВ ПРОЙДЕНО» / «СРЕДНИЙ БАЛЛ». */}
        <View
          style={[
            {
              position: "relative",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: 20,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(99,102,241,0.35)" }),
          ]}
        >
          <LinearGradient
            colors={["#38bdf8", "#6366f1"]}
            {...gradPoints(135)}
            style={StyleSheet.absoluteFill}
          />
          {/* inset-блик 0 1.5 0 W35 — верхняя hairline-полоска. */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: "rgba(255,255,255,0.35)",
            }}
          />

          {/* Блок 4a: Ring-донат 70×70. */}
          <Ring
            size={70}
            viewBoxSize={88}
            r={32}
            thickness={9}
            value={donutPct}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.3)"
            centerContent={
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
                {`${donutPct}%`}
              </Text>
            }
          />

          <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
            {/* Блок 4b: «ТЕСТОВ ПРОЙДЕНО». */}
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 8,
                  letterSpacing: 8 * 0.06,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                ТЕСТОВ ПРОЙДЕНО
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
                {doneCount}
              </Text>
            </View>

            {/* Блок 4c: вертикальный разделитель. */}
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />

            {/* Блок 4d: «СРЕДНИЙ БАЛЛ». */}
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 8,
                  letterSpacing: 8 * 0.06,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                СРЕДНИЙ БАЛЛ
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
                {avgGrade}
              </Text>
            </View>
          </View>
        </View>

        {/* Блок 5: FilterPillsRow — «Все» / «Пройденные» / «Предстоящие». */}
        <View style={{ flexDirection: "row", gap: 7 }}>
          {filters.map((f) => {
            const isActive = f.key === activeFilter;
            if (isActive) {
              return (
                <View
                  key={f.key}
                  style={[
                    { flex: 1, borderRadius: 999, overflow: "hidden" },
                    shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" }),
                  ]}
                >
                  <LinearGradient
                    colors={["#7C3AED", "#4F6DF5"]}
                    {...gradPoints(135)}
                    style={{ paddingVertical: 9, alignItems: "center" }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: "#FFFFFF" }}>
                      {f.label}
                    </Text>
                  </LinearGradient>
                </View>
              );
            }
            return (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  paddingVertical: 9,
                  alignItems: "center",
                  backgroundColor: scheme === "light" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: scheme === "light" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.14)",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: inactiveTabTextColor }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Блок 6: TestRowsList. */}
        {filteredTests.map((row) => (
          <TestRowCard
            key={`${row.subject_id}-${row.name}`}
            row={row}
            onPress={() => navigation.navigate("da1")}
          />
        ))}
      </ScrollView>

      {/* Блок 7: Шторка выбора ребёнка. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
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
