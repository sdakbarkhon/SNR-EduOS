/**
 * Экран «Все предметы» (dallsubj) — Заход 5.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1364–1382:
 *  1365–1369 шапка: back-glass 38, заголовок Unbounded 15/600 «Все предметы»,
 *   фильтр-glass 38 (3 линии убывающей длины);
 *  1370 scroll: gap 12, padding 4 18 118;
 *  1371 ChildSwitcherCard compact (аватар 44 + ФИО + «{cl} класс» + шеврон),
 *   openSheet → BottomSheetFrame с ChildPickerSheetContent;
 *  1372 summary-полоса: «{count} предметов» / «Средний балл {avg} ★»;
 *  1373–1379 sc-for allSubjRows: карточка предмета (SubjectTile 42 r14 + name +
 *   teacher + gradeChip; ProgressBar 5.5 с градиентом предмета + delta right;
 *   meta-строка 9.5/600 muted), goSubj → 'd11'.
 *
 * Замечания:
 *  - Правая кнопка в шапке — ФИЛЬТР (three-line icon, строка 1368), не поиск:
 *   в макете обработчик назван {{ goSearch }}, но это переиспользуемая шапка
 *   и глиф в этой копии — три линии разной длины. Обработчик здесь = onFilter
 *   (сейчас no-op: sheet-фильтр — Nice-to-have, вне блок-листа Захода 5).
 *  - {count} и {avg} — из SUBJECT_STATS.length и getGradesSummary().average_label
 *   (единый источник среднего балла 4.6 из fixtures/grades.ts).
 *  - Правила заказчика (нет опозданий/кружков, «Идёт сейчас»/перемены и SVG
 *   overflow с радаром) на этом экране НЕ применимы — экран статистический.
 *
 * Данные — только через аксессоры src/data. Тексты — d.parentApp.*. Обе темы
 * через useTheme(); iOS safe-area — из InnerHeader; paddingBottom 118 под
 * FloatingTabBar (у экрана его нет, но выравниваем со всеми внутренними).
 */
import { useState } from "react";
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
  SubjectTile,
  type ChildPickerItem,
  type SubjectId,
} from "../../ui";
import { ProgressBar } from "../../ui/charts";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getGradesSummary,
  getSelectedChildContext,
  getSubject,
  getSubjectStats,
} from "../../data";
import type { BaseSubjectKey, SubjectStatRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Глиф предмета (макет: prog «</>», math «√x», eng «Aa», rus «✏», robo «⚙»). */
const SUBJECT_GLYPH: Record<BaseSubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** Иконка «Фильтр» в правой стеклянной кнопке шапки — три линии убывающей
 *  длины (макет строка 1368: 18 stroke 1.8). */
function FilterGlyph({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 12h10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 18h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Звёздочка `#f59e0b` рядом с «Средний балл 4.6» (макет строка 1372, 12×12). */
function StarGlyph({ size = 12, color = "#F59E0B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
    </Svg>
  );
}

/** Карточка предмета в списке «Все предметы» (макет строки 1374–1378). */
function SubjectRowCard({
  stat,
  onPress,
}: {
  stat: SubjectStatRow;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  const subject = getSubject(stat.subject_id);
  const st = stat.is_up ? tokens.status.green : tokens.status.red;

  return (
    <GlassCard
      radius={20}
      onPress={onPress}
      contentStyle={{ padding: 14, gap: 9 }}
    >
      {/* Строка 1: иконка + название + учитель + чип-оценка. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <SubjectTile
          subjectId={stat.subject_id as SubjectId}
          size={42}
          radius={14}
          glyph={SUBJECT_GLYPH[stat.subject_id]}
        />
        <View style={{ flex: 1, minWidth: 0, flexDirection: "column" }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}
          >
            {subject.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}
          >
            {subject.teacher_name}
          </Text>
        </View>
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 9,
            borderRadius: 8,
            borderWidth: 1,
            backgroundColor: subject.chip_bg,
            borderColor: subject.chip_border,
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: subject.text_color }}>
            {stat.grade_label}
          </Text>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: subject.text_color }}>
            ★
          </Text>
        </View>
      </View>

      {/* Строка 2: прогресс-бар (5.5, градиент предмета) + delta справа. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ProgressBar
            pct={stat.pct / 100}
            height={5.5}
            fillGradient={subject.gradient}
          />
        </View>
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10,
            color: st.text,
          }}
        >
          {stat.delta_label}
        </Text>
      </View>

      {/* Строка 3: meta («24 урока · 18 заданий за месяц»). */}
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
        {stat.meta_label}
      </Text>
    </GlassCard>
  );
}

export default function AllSubjectsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const stats = getSubjectStats();
  const summary = getGradesSummary();

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

  const onFilter = () => {
    // Фильтр/сортировка списка предметов — Nice-to-have, вне блок-листа
    // Захода 5. В макете обработчик называется goSearch, но глиф — три линии
    // (фильтр), а не лупа. Оставлен как no-op заглушка.
  };

  return (
    <AppBackground>
      {/* Block 1: TopBar_Header — InnerHeader + правая glass-кнопка «Фильтр». */}
      <InnerHeader
        title={d.parentApp.scr.allSubjects}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={onFilter}>
            <FilterGlyph color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      {/* Block 2: Scrollable_List_Container. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* Block 3: Child_Switcher_Card (compact, без status/switchLabel —
            только аватар + ФИО + «{cl} класс» + шеврон, как в макете 1371). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          chevron
          onPress={() => setSheetOpen(true)}
        />

        {/* Block 4: Summary_Bar — «{count} предметов» / «Средний балл {avg} ★». */}
        <GlassCard
          radius={18}
          contentStyle={{
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink2 }}>
            {`${stats.length} предметов`}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
              {`${d.parentApp.grades.average} ${summary.average_label}`}
            </Text>
            <StarGlyph />
          </View>
        </GlassCard>

        {/* Block 5: Subject_Card_List — sc-for allSubjRows → карточки предметов. */}
        {stats.map((s) => (
          <SubjectRowCard
            key={s.subject_id}
            stat={s}
            onPress={() => navigation.navigate("d11")}
          />
        ))}
      </ScrollView>

      {/* Sheet выбора ребёнка (openSheet макета). */}
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
