/**
 * П5 «Главная» (Dashboard) — заход 4.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 219–271:
 *  220–225 шапка (RootHeader с логотипом), 227 приветствие,
 *  228–241 ChildSwitcherCard large + MetricsSplitRow (5 колонок),
 *  242–245 AccentCard «Следующий урок», 246–249 ряд «К оплате / Питание»,
 *  250–254 AccentCard «EduOS Assistant» с 2 CTA, 255–263 QuickActionGrid 3×2,
 *  264 SectionHeader ленты, 265–269 GlassCard с 3 ListRow «Сегодня».
 *
 * Данные — через аксессоры src/data (getDashboard, getChildren,
 * getSelectedChildContext, getUnreadNotificationsCount). Тексты — через
 * useAppLocale().d.parentApp.* (RU/UZ/EN). Обе темы через useTheme().
 * iOS safe-area у шапки — из RootHeader; у скролла — paddingBottom 118px
 * под FloatingTabBar (макет: строка 226 — «118 под FloatingTabBar»).
 */
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  AccentInset,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  ListRow,
  MetricsSplitRow,
  QuickActionTile,
  QuickActionsGrid,
  RootHeader,
  SectionHeader,
  StatusChip,
  type ChildPickerItem,
  type MetricCell,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getDashboard,
  getParent,
  getSelectedChildContext,
  getUnreadNotificationsCount,
} from "../../data";
import { ICONS, type MainStackParamList, type TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../lib/format";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Иконка-глиф из inline SVG-paths, 17px белым — как quick-action и «Следующий урок». */
function WhiteGlyph({ paths, size = 17 }: { paths: string[]; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/** Плитка 46×46 grad-glass с глифом-строкой («√x») — макет строка 244. */
function AccentGlyphTile({
  gradient,
  glyph,
  size = 46,
}: {
  gradient: [string, string];
  glyph: string;
  size?: number;
}) {
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
      }}
    >
      <LinearGradient colors={gradient} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>{glyph}</Text>
        </View>
      </View>
    </View>
  );
}

/** Chip-«5» 30×30 rounded-10 зелёный — макет строка 267 (feed #1, оценка). */
function GradeBadge({ value }: { value: number }) {
  const { tokens } = useTheme();
  const st = tokens.status.green;
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: `rgba(${st.rgb},0.14)`,
        borderWidth: 1,
        borderColor: `rgba(${st.rgb},0.35)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: st.text }}>{value}</Text>
    </View>
  );
}

/** Иконка feed-ряда 36×36 rounded-12 с градиентом и текстовым/SVG-глифом. */
function FeedIconTile({
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
    <LinearGradient
      colors={gradient}
      start={g.start}
      end={g.end}
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {svgPaths ? (
        <WhiteGlyph paths={svgPaths} size={17} />
      ) : (
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>{glyph}</Text>
      )}
    </LinearGradient>
  );
}

/** Иконка «CTA-glass» для акцентной карточки ассистента (chip-стиль). */
function AssistantCta({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <AccentInset
      radius={12}
      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
      onPress={onPress}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </AccentInset>
  );
}

export default function HomeScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  const parent = getParent();
  const dashboard = getDashboard(childId);
  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  const bellCount = getUnreadNotificationsCount();

  // Приветствие: «Доброе утро, Дилноза!» + «Вот что происходит у Малики сегодня».
  const greetingTitle = `${dashboard.greeting.title_prefix}${parent.first_name}!`;
  const greetingSub = dashboard.greeting.subtitle_template.replace("{gen}", child.first_name_gen);

  // 5 колонок метрики-сплит (макет 230–240). Валюта коротким — «185 000 сум».
  const metricCells: MetricCell[] = [
    { label: d.parentApp.home.atSchoolSince, value: dashboard.child_status.at_school_since_label },
    { label: d.parentApp.home.lessons, value: String(dashboard.child_status.lessons_total) },
    {
      label: d.parentApp.home.attended,
      value: `${dashboard.child_status.lessons_attended}/${dashboard.child_status.lessons_total}`,
      valueColor: tokens.status.green.text,
    },
    {
      label: d.parentApp.home.hw,
      value: String(dashboard.child_status.homework_count),
      valueColor: tokens.status.orange.text,
    },
    {
      label: d.parentApp.home.wallet,
      value: `${formatMoney(dashboard.wallet_balance)} ${d.parentApp.pay.sum}`,
      flex: 1.4,
    },
  ];

  const dueSum = `${formatMoney(dashboard.due_card.amount)} ${d.parentApp.pay.sum}`;
  const dueSubtitle = `${dashboard.due_card.bills_count} счёта · ${dashboard.due_card.until_label}`;

  // Пункты шторки выбора ребёнка (BottomSheetFrame + ChildPickerSheetContent).
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

  // Пункты quick-actions (макет 256–263). Иконки из ICONS + inline paths.
  // «Оплатить» → card; «Дом. задания» → check; «Все сервисы» → grid;
  // «Питание» → food; «Профиль ребёнка» → user; «Расписание» → cal.
  type QuickGo = "d18" | "d12" | "d9" | "dmeals" | "d29" | "d15";
  const QUICKS: {
    label: string;
    gradient: [string, string];
    iconPaths: string[];
    shadowRgb: string;
    go: QuickGo;
  }[] = [
    { label: d.parentApp.home.pay, gradient: ["#fb923c", "#ef4444"], iconPaths: ICONS.card, shadowRgb: "251,146,60", go: "d18" },
    { label: d.parentApp.home.hwShort, gradient: ["#60a5fa", "#2563eb"], iconPaths: ICONS.check, shadowRgb: "96,165,250", go: "d12" },
    { label: d.parentApp.scr.services, gradient: ["#a78bfa", "#7c3aed"], iconPaths: ICONS.grid, shadowRgb: "167,139,250", go: "d9" },
    { label: d.parentApp.svc.meals, gradient: ["#f472b6", "#db2777"], iconPaths: ICONS.food, shadowRgb: "244,114,182", go: "dmeals" },
    { label: d.parentApp.scr.childProfile, gradient: ["#34d399", "#059669"], iconPaths: ICONS.user, shadowRgb: "52,211,153", go: "d29" },
    { label: d.parentApp.scr.schedule, gradient: ["#22d3ee", "#0891b2"], iconPaths: ICONS.cal, shadowRgb: "34,211,238", go: "d15" },
  ];

  return (
    <AppBackground>
      <RootHeader
        title="SNR EduOS"
        titleSize={14}
        showLogo
        bellCount={bellCount}
        onBellPress={() => navigation.navigate("d8")}
        avatar={{
          initials: parent.initials,
          gradient: parent.avatar_gradient,
          variant: "ring",
        }}
        onAvatarPress={() => navigation.navigate("dhub")}
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
        {/* Приветствие (227). */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, color: tokens.ink1 }}>
            {greetingTitle}
          </Text>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 12, color: tokens.ink2 }}>
            {greetingSub}
          </Text>
        </View>

        {/* ChildSwitcherCard large + MetricsSplitRow (228–241). */}
        <ChildSwitcherCard
          variant="large"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          status={{ label: child.status_chip, tone: "green", withChevron: true }}
          chevron
          onPress={() => setSheetOpen(true)}
          onStatusPress={() => navigation.navigate("d6")}
          footer={<MetricsSplitRow cells={metricCells} topDivider />}
        />

        {/* AccentCard «Следующий урок» (242–245). */}
        <AccentCard
          gradient={dashboard.next_lesson.gradient}
          angle={135}
          shadowRgb="99,102,241"
          radius={20}
          contentStyle={{
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
          onPress={() => navigation.navigate("d15")}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {d.parentApp.home.nextLesson}
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15.5, color: "#FFFFFF" }}>
              {dashboard.next_lesson.subject_name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 11.5,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {dashboard.next_lesson.time_room_teacher_label}
            </Text>
          </View>
          <AccentGlyphTile gradient={dashboard.next_lesson.gradient} glyph={dashboard.next_lesson.tile_label} />
        </AccentCard>

        {/* Ряд «К оплате / Питание» (246–249). */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <AccentCard
            gradient={[dashboard.due_card.gradient[0], dashboard.due_card.gradient[1]]}
            shadowRgb="244,63,94"
            radius={18}
            contentStyle={{ padding: 12, gap: 4 }}
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("p17")}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {d.parentApp.status.due}
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
              {dueSum}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.9)" }}>
              {dueSubtitle}
            </Text>
          </AccentCard>
          <AccentCard
            gradient={[dashboard.meals_card.gradient[0], dashboard.meals_card.gradient[1]]}
            shadowRgb="52,211,153"
            radius={18}
            contentStyle={{ padding: 12, gap: 4 }}
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("dmeals")}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {d.parentApp.svc.meals}
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
              {dashboard.meals_card.status_label}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.9)" }}>
              {dashboard.meals_card.until_label}
            </Text>
          </AccentCard>
        </View>

        {/* AccentCard «EduOS Assistant» + 2 CTA (250–254). */}
        <AccentCard
          gradient={["#8b5cf6", "#6366f1"]}
          shadowRgb="139,92,246"
          radius={20}
          contentStyle={{ padding: 14, gap: 10 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WhiteGlyph paths={ICONS.spark} size={18} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
              EduOS Assistant
            </Text>
            <StatusChip label="NEW" variant="new" />
          </View>
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 12,
              lineHeight: 12 * 1.55,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {dashboard.assistant_text}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <AssistantCta
                label={d.parentApp.home.viewProgress}
                onPress={() => navigation.navigate("p10")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AssistantCta
                label={d.parentApp.home.msgTeacher}
                onPress={() => navigation.navigate("d24")}
              />
            </View>
          </View>
        </AccentCard>

        {/* Быстрые действия (255–263). */}
        <SectionHeader title={d.parentApp.home.quickActions} />
        <QuickActionsGrid columns={3}>
          {QUICKS.map((q) => (
            <QuickActionTile
              key={q.label}
              label={q.label}
              gradient={q.gradient}
              shadowRgb={q.shadowRgb}
              icon={<WhiteGlyph paths={q.iconPaths} size={17} />}
              onPress={() => navigation.navigate(q.go as never)}
            />
          ))}
        </QuickActionsGrid>

        {/* Лента «Сегодня» (264–269). */}
        <SectionHeader
          title={d.parentApp.home.todaySection}
          linkLabel={`${d.parentApp.common.viewAll} ›`}
          onPress={() => navigation.navigate("d8")}
        />
        <GlassCard radius={22} contentStyle={{ paddingHorizontal: 14 }}>
          {dashboard.feed.map((row, idx) => {
            // Иконка ряда — по маршруту go: d11 → math √x, d12 → eng Aa, dmeals → food.
            const icon =
              row.go === "d11" ? (
                <FeedIconTile gradient={["#facc15", "#ca8a04"]} glyph="√x" />
              ) : row.go === "d12" ? (
                <FeedIconTile gradient={["#f472b6", "#db2777"]} glyph="Aa" />
              ) : (
                <FeedIconTile gradient={["#34d399", "#0ea5e9"]} svgPaths={ICONS.food} />
              );
            const right =
              row.badge.kind === "grade" ? (
                <GradeBadge value={row.badge.value} />
              ) : (
                <StatusChip
                  label={row.badge.label}
                  family={
                    row.badge.label === "Успешно"
                      ? "green"
                      : row.badge.label.indexOf("Срок") === 0
                        ? "orange"
                        : "gray"
                  }
                />
              );
            return (
              <ListRow
                key={idx}
                left={icon}
                title={row.title}
                subtitle={row.subtitle}
                right={right}
                divider={idx > 0}
                verticalPadding={10}
                onPress={() => navigation.navigate(row.go as never)}
              />
            );
          })}
        </GlassCard>
      </ScrollView>

      {/* Шторка выбора ребёнка. */}
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
