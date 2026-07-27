/**
 * d26 «Объявления» — Заход 7 REBUILD, block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 801–839.
 *
 * Порядок блоков (block-list, сверху вниз, обязательный):
 *  1. Header — InnerHeader (glass back + Unbounded 15 title
 *     d.parentApp.scr.announcements) + правый glass-menu (три линии) →
 *     goStub('actions') как в макете (goActions).
 *  2. ScrollView-контейнер (gap 11, padding 4 18 118) — нижний отступ
 *     под FloatingTabBar.
 *  3. SegmentPills 4 таба «Все / Важные / Мероприятия / Информация» —
 *     фильтр по TYPE карточки (совпадает с бэджами). Не «кружки».
 *  4–7. Announcement cards ×4 — Ярмарка (Важно/red), Родительское
 *     собрание (Мероприятие/green), Транспорт (Информация/blue,
 *     иконка автобус), Обновление приложения (Информация/blue).
 *     Каждая карточка: бэдж-тип + дата · hero-градиент 104h с
 *     плейсхолдер-иконкой (img/bus) · title 13.5/800 · body
 *     10.5/600 · футер author · views · comments.
 *     onPress → goAdmin27 (navigate('d27')).
 *
 * UI-decisions extract-агента:
 *  · Кружков нет; 4 карточки соответствуют мокапу 1:1.
 *  · Табы = фильтр по типу объявления, оставлены.
 *  · Menu-иконка — заглушка (stub:actions), без побочных эффектов.
 *  · Read-only счётчики views/comments; детали → экран 27.
 *
 * Данные — inline-фикстура (announcements-фикстуры в data/fixtures/ нет;
 * добавлять её вне скоупа Захода 7). Тексты — литералы, соответствующие
 * ru-макету; при появлении локали переносится в d.parentApp.
 *
 * Обе темы через useTheme(); status-цвета — из tokens.status
 * (red / green / blue). InnerHeader держит iOS safe-area.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { GlassCard, GlassCircleButton, InnerHeader, SegmentPills } from "../../ui";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

type BadgeKind = "important" | "event" | "info";
type FilterKind = "all" | BadgeKind;
type HeroIcon = "img" | "bus";

interface AnnouncementRow {
  id: string;
  badge: BadgeKind;
  badgeLabel: string;
  date: string;
  hero: {
    icon: HeroIcon;
    gradient: [string, string];
  };
  title: string;
  body: string;
  author: string;
  views: number;
  comments: number;
}

/* ═══ inline-фикстура: 4 карточки макета (строки 809–838) ═══ */
const ANNOUNCEMENTS: AnnouncementRow[] = [
  {
    id: "fair",
    badge: "important",
    badgeLabel: "Важно",
    date: "21 июля 2026",
    hero: { icon: "img", gradient: ["rgba(244,63,94,0.24)", "rgba(251,146,60,0.24)"] },
    title: "Школьная ярмарка",
    body: "24 июля состоится ежегодная школьная ярмарка! Ждём вас и ваших детей — активности, выступления и угощения.",
    author: "Администрация школы",
    views: 245,
    comments: 12,
  },
  {
    id: "meeting",
    badge: "event",
    badgeLabel: "Мероприятие",
    date: "20 июля 2026",
    hero: { icon: "img", gradient: ["rgba(16,185,129,0.22)", "rgba(14,165,233,0.22)"] },
    title: "Родительское собрание",
    body: "30 июля в 18:00 состоится родительское собрание для 1–11 классов в актовом зале школы.",
    author: "Администрация школы",
    views: 189,
    comments: 8,
  },
  {
    id: "transport",
    badge: "info",
    badgeLabel: "Информация",
    date: "19 июля 2026",
    hero: { icon: "bus", gradient: ["rgba(251,191,36,0.24)", "rgba(249,115,22,0.22)"] },
    title: "Изменение маршрута транспорта",
    body: "С 28 июля маршрут №3 будет отправляться на 10 минут позже. Проверьте новое расписание в разделе «Транспорт».",
    author: "Транспортный отдел",
    views: 156,
    comments: 6,
  },
  {
    id: "release",
    badge: "info",
    badgeLabel: "Информация",
    date: "18 июля 2026",
    hero: { icon: "img", gradient: ["rgba(124,58,237,0.22)", "rgba(34,211,238,0.22)"] },
    title: "Обновление SNR EduOS",
    body: "В приложении появились раздел «Все сервисы», обновлённое расписание с темами уроков и уведомления.",
    author: "Пресс-служба школы",
    views: 98,
    comments: 3,
  },
];

/** Маппинг badge → status-семейство токенов темы. */
const BADGE_STATUS: Record<BadgeKind, "red" | "green" | "blue"> = {
  important: "red",
  event: "green",
  info: "blue",
};

export default function AnnouncementsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const [filter, setFilter] = useState<FilterKind>("all");

  const FILTERS: { key: FilterKind; label: string }[] = [
    { key: "all", label: d.parentApp.pay.all },
    { key: "important", label: d.parentApp.msg.storyImportant },
    { key: "event", label: "Мероприятия" },
    { key: "info", label: d.parentApp.about.info },
  ];

  const shown = useMemo(
    () => (filter === "all" ? ANNOUNCEMENTS : ANNOUNCEMENTS.filter((a) => a.badge === filter)),
    [filter],
  );

  const activeIndex = Math.max(
    0,
    FILTERS.findIndex((f) => f.key === filter),
  );

  return (
    <AppBackground>
      {/* 1. Header — glass-back + title + glass-menu (три линии). */}
      <InnerHeader
        title={d.parentApp.scr.announcements}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton
            onPress={() => navigation.navigate("stub", { stubKey: "actions" })}
          >
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.ink1}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M3 6h18" />
              <Path d="M7 12h10" />
              <Path d="M10 18h4" />
            </Svg>
          </GlassCircleButton>
        }
      />

      {/* 2. Скролл-контейнер. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* 3. SegmentPills — фильтр по типу объявления. */}
        <SegmentPills
          items={FILTERS.map((f) => f.label)}
          activeIndex={activeIndex}
          onChange={(i) => setFilter(FILTERS[i].key)}
        />

        {/* 4–7. Карточки объявлений. */}
        {shown.map((a) => (
          <AnnouncementCard
            key={a.id}
            row={a}
            onPress={() => navigation.navigate("d27")}
          />
        ))}
      </ScrollView>
    </AppBackground>
  );
}

/* ═══ Карточка объявления ═══
 *
 * Layout (макет строки 810–815): бэдж-тип · дата — hero 104 — title —
 * body — hairline — footer (author · views · comments).
 */
function AnnouncementCard({
  row,
  onPress,
}: {
  row: AnnouncementRow;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const status = tokens.status[BADGE_STATUS[row.badge]];
  const chip = tokens.chip(status.rgb);

  return (
    <GlassCard
      radius={22}
      onPress={onPress}
      contentStyle={{
        padding: 13,
        gap: 10,
      }}
    >
      {/* Верх: бэдж-тип + дата справа. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 9,
            borderRadius: 999,
            backgroundColor: chip.bg,
            borderColor: chip.border,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: status.text }}>
            {row.badgeLabel}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>
          {row.date}
        </Text>
      </View>

      {/* Hero — градиент 104h + плейсхолдер-иконка. */}
      <HeroBlock icon={row.hero.icon} gradient={row.hero.gradient} />

      {/* Title. */}
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: tokens.ink1 }}>
        {row.title}
      </Text>

      {/* Body. */}
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 10.5,
          lineHeight: 10.5 * 1.5,
          color: tokens.ink2,
        }}
      >
        {row.body}
      </Text>

      {/* Футер: hairline + author + views + comments. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: 6,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tokens.ink3,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: fonts.manrope700,
            fontSize: 9.5,
            color: tokens.ink3,
          }}
        >
          {row.author}
        </Text>
        <View style={{ flex: 1 }} />
        <FooterMetric icon="eye" value={row.views} />
        <FooterMetric icon="chat" value={row.comments} />
      </View>
    </GlassCard>
  );
}

/** Hero-блок 104h: градиент + плейсхолдер-иконка (img/bus). */
function HeroBlock({ icon, gradient }: { icon: HeroIcon; gradient: [string, string] }) {
  const { tokens } = useTheme();
  const strokeColor = tokens.ink3;
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{
        height: 104,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.8)",
      }}
    >
      <Svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon === "img" ? (
          <>
            <Rect x={3} y={3} width={18} height={18} rx={4} />
            <Circle cx={9} cy={9} r={2} />
            <Path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
          </>
        ) : (
          <>
            <Path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
            <Path d="M4 11h16" />
            <Path d="M8 18v2" />
            <Path d="M16 18v2" />
          </>
        )}
      </Svg>
    </LinearGradient>
  );
}

/** Метрика футера: 12×12 глиф + число 9.5/700 ink3. */
function FooterMetric({ icon, value }: { icon: "eye" | "chat"; value: number }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Svg
        width={icon === "eye" ? 12 : 11}
        height={icon === "eye" ? 12 : 11}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.ink3}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon === "eye" ? (
          <>
            <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <Circle cx={12} cy={12} r={3} />
          </>
        ) : (
          <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        )}
      </Svg>
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>
        {value}
      </Text>
    </View>
  );
}
