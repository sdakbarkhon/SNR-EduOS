/**
 * d26 «Объявления» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: четыре карточки, вкомпилированные прямо в файл («Школьная ярмарка»,
 * «Изменение маршрута транспорта» …), с придуманными счётчиками просмотров и
 * комментариев.
 *
 * СТАЛО: `getParentAnnouncements` из @snr/core — таблица `announcements`
 * (родителю её открыла миграция 126), тот же запрос, что питает «Объявления»
 * на вебе. Карточка ведёт на d27 с id объявления.
 *
 * ЧЕГО НЕТ И ПОЧЕМУ:
 *  • счётчиков просмотров и комментариев — таких колонок в базе не
 *    существует, и рисовать выдуманные числа на настоящем экране нельзя;
 *  • картинки-обложки — вложений у объявления нет, поэтому hero остаётся
 *    декоративным градиентом (в макете это и был плейсхолдер);
 *  • фильтры — по РЕАЛЬНОЙ колонке `category` (general / academic / event /
 *    urgent / reminder), а не по выдуманному набору «Важно / Мероприятие /
 *    Информация».
 *
 * Подписи категорий, фильтров и пустых состояний — общий с вебом словарь
 * `parentApp.ann`: одна и та же надпись не должна иметь двух переводов.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getParentAnnouncements, LOCALE_TAG, type Dictionary, type ParentAnnouncement } from "@snr/core";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  LoadingBlock,
  SegmentPills,
} from "../../ui";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useDemoSession } from "../../context/DemoSessionContext";
import { getAnnouncements } from "../../data";
import type { AnnouncementCategory } from "../../data";
import { getSupabase } from "../../lib/supabase";
import { fullDate } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type AnnDict = Dictionary["parentApp"]["ann"];

/**
 * category → подпись в словаре, семейство статус-цветов и градиент hero.
 * Цвета остаются здесь (это оформление), подписи — в словаре. Набор ключей
 * тот же, что на вебе (AnnouncementsView.tsx): экраны обязаны называть одну
 * и ту же категорию одинаково.
 */
const CATEGORY_META: Record<
  string,
  { key: keyof AnnDict; family: "red" | "green" | "blue" | "orange" | "violet"; hero: [string, string] }
> = {
  urgent: { key: "catUrgent", family: "red", hero: ["rgba(244,63,94,0.24)", "rgba(251,146,60,0.24)"] },
  event: { key: "catEvent", family: "green", hero: ["rgba(16,185,129,0.22)", "rgba(14,165,233,0.22)"] },
  academic: { key: "catAcademic", family: "blue", hero: ["rgba(59,130,246,0.22)", "rgba(34,211,238,0.22)"] },
  reminder: { key: "catReminder", family: "orange", hero: ["rgba(251,191,36,0.24)", "rgba(249,115,22,0.22)"] },
  general: { key: "catGeneral", family: "violet", hero: ["rgba(124,58,237,0.22)", "rgba(34,211,238,0.22)"] },
};

const FALLBACK_META = CATEGORY_META.general;

type Filter = "all" | "urgent" | "event" | "academic";

const FILTER_KEYS: { key: Filter; label: keyof AnnDict }[] = [
  { key: "all", label: "filterAll" },
  { key: "urgent", label: "filterUrgent" },
  { key: "event", label: "filterEvent" },
  { key: "academic", label: "filterAcademic" },
];

export default function AnnouncementsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const ann = d.parentApp.ann;
  const m4 = d.parentApp.more4;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();

  const [filter, setFilter] = useState<Filter>("all");

  // Витрина: четыре карточки макета и свой набор чипов. У настоящего
  // экрана фильтры другие (срочные / события / учёба) — сводить их не
  // стали: это разные наборы категорий, и оба из своего источника.
  const { isDemo: showcase } = useDemoSession();
  const sc = d.parentApp.showcase;
  const [scFilter, setScFilter] = useState<AnnouncementCategory | null>(null);
  const scData = getAnnouncements(locale, scFilter);
  const SC_FILTERS: { key: AnnouncementCategory | null; label: string; tone: "red" | "green" | "blue" }[] = [
    { key: null, label: sc.allChip, tone: "blue" },
    { key: "imp", label: sc.filterImportant, tone: "red" },
    { key: "event", label: d.parentApp.ann.catEvent, tone: "green" },
    { key: "info", label: sc.filterInfo, tone: "blue" },
  ];
  const CHIP_TEXT: Record<AnnouncementCategory, string> = {
    imp: sc.importantBadge,
    event: d.parentApp.ann.catEvent,
    info: d.parentApp.ann.catGeneral,
  };
  const CHIP_TONE: Record<AnnouncementCategory, "red" | "green" | "blue"> = {
    imp: "red",
    event: "green",
    info: "blue",
  };

  const state = useAsyncData(() => getParentAnnouncements(getSupabase(), 100), []);
  const items = useMemo(() => state.data ?? [], [state.data]);

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((a) => a.category === filter)),
    [filter, items],
  );

  const activeIndex = Math.max(0, FILTER_KEYS.findIndex((f) => f.key === filter));

  return (
    <AppBackground>
      <InnerHeader
        title={d.parentApp.scr.announcements}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("d8")}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </Svg>
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {showcase ? (
          <SegmentPills
            items={SC_FILTERS.map((f) => f.label)}
            activeIndex={Math.max(0, SC_FILTERS.findIndex((f) => f.key === scFilter))}
            onChange={(i) => setScFilter(SC_FILTERS[i].key)}
          />
        ) : (
          <SegmentPills
            items={FILTER_KEYS.map((f) => ann[f.label])}
            activeIndex={activeIndex}
            onChange={(i) => setFilter(FILTER_KEYS[i].key)}
          />
        )}

        {showcase ? (
          scData.rows.length === 0 ? (
            <EmptyBlock title={ann.emptyFilterTitle} text={ann.emptyFilterText} />
          ) : (
            scData.rows.map((a) => {
              const tone = tokens.status[CHIP_TONE[a.category]];
              return (
                <Pressable
                  key={a.id}
                  onPress={() => (a.go ? navigation.navigate(a.go as never) : undefined)}
                  style={({ pressed }: { pressed: boolean }) => ({ opacity: pressed && a.go ? 0.75 : 1 })}
                >
                  <GlassCard radius={20} contentStyle={{ padding: 13, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: tokens.chip(tone.rgb).bg,
                          borderWidth: 1,
                          borderColor: tokens.chip(tone.rgb).border,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: tone.text }}>
                          {CHIP_TEXT[a.category]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                        {a.date_label}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
                      {a.title}
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 17, color: tokens.ink2 }}>
                      {a.text}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink3 }}>
                        {a.author}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                        {`👁 ${a.views}`}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                        {`💬 ${a.comments}`}
                      </Text>
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })
          )
        ) : state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : shown.length === 0 ? (
          <EmptyBlock
            title={items.length === 0 ? ann.emptyTitle : ann.emptyFilterTitle}
            text={items.length === 0 ? ann.emptyText : ann.emptyFilterText}
          />
        ) : (
          shown.map((a) => (
            <AnnouncementCard
              key={a.id}
              row={a}
              localeTag={localeTag}
              ann={ann}
              onPress={() => navigation.navigate("d27", { announcementId: a.id })}
            />
          ))
        )}
      </ScrollView>
    </AppBackground>
  );
}

/** Карточка объявления: бэдж-категория · дата — hero — заголовок — текст —
 *  автор. Счётчиков в футере нет: их неоткуда взять. */
export function AnnouncementCard({
  row,
  localeTag,
  ann,
  onPress,
}: {
  row: ParentAnnouncement;
  localeTag: string;
  ann: AnnDict;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const meta = CATEGORY_META[row.category] ?? FALLBACK_META;
  const status = tokens.status[meta.family];
  const chip = tokens.chip(status.rgb);

  return (
    <GlassCard radius={22} onPress={onPress} contentStyle={{ padding: 13, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: status.text }}>{ann[meta.key]}</Text>
          </View>
          {row.isFromAdmin ? (
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 9,
                borderRadius: 999,
                backgroundColor: "rgba(124,58,237,0.12)",
                borderColor: "rgba(124,58,237,0.3)",
                borderWidth: 1,
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: tokens.accent }}>{ann.adminChip}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>
          {fullDate(row.created_at, localeTag)}
        </Text>
      </View>

      <HeroBlock gradient={meta.hero} />

      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: tokens.ink1 }}>{row.title}</Text>

      <Text
        numberOfLines={4}
        style={{ fontFamily: fonts.manrope600, fontSize: 10.5, lineHeight: 10.5 * 1.5, color: tokens.ink2 }}
      >
        {row.body}
      </Text>

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
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>
          {row.authorName ?? ann.authorSchool}
        </Text>
      </View>
    </GlassCard>
  );
}

/** Hero-блок 104h: декоративный градиент категории. Обложек у объявления
 *  в базе нет — здесь и в макете это плейсхолдер. */
function HeroBlock({ gradient }: { gradient: [string, string] }) {
  const { tokens } = useTheme();
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
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={tokens.ink3} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={3} width={18} height={18} rx={4} />
        <Circle cx={9} cy={9} r={2} />
        <Path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </Svg>
    </LinearGradient>
  );
}
