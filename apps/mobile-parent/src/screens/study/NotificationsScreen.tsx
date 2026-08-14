/**
 * П8 «Уведомления» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: фикстура `NOTIFICATIONS` из шести строк, разложенных по «сегодня» и
 * «вчера» вручную, с выдуманным флагом «важное» и переходами по фикстурному
 * полю `go`.
 *
 * СТАЛО: `getMyNotifications` из @snr/core — таблица `notifications` (RLS
 * отдаёт только свои строки), тот же запрос, что питает «Уведомления» на
 * вебе.
 *
 * ОТЛИЧИЯ ОТ МАКЕТА:
 *  • фильтров два, а не три. «Важные» в макете опирались на выдуманный флаг
 *    is_important, которого в `notifications` нет — остались «Все» и
 *    «Непрочитанные»;
 *  • секции — «Сегодня / Вчера / Ранее»: у настоящего родителя уведомления
 *    старше вчерашнего дня есть, а в фикстуре их не бывало;
 *  • иконка и переход выбираются по `kind` (реальная колонка), а не по
 *    фикстурному `go`.
 *
 * ПЕРЕХОДЫ. `notifications.link` рассчитан на ученический веб («/homework»,
 * «/grades»…) и в родительском приложении ведёт не туда, поэтому экран
 * выбирается по `kind` и указывает на РОДИТЕЛЬСКИЕ маршруты. Виды, для
 * которых у родителя подходящего экрана нет, остаются некликабельными: это
 * честнее, чем увести на чужой раздел.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getMyNotifications, LOCALE_TAG, type AppNotification } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  InnerHeader,
  LoadingBlock,
  SegmentPills,
} from "../../ui";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { getSupabase } from "../../lib/supabase";
import { addDays, tashkentDateKey } from "../../lib/tashkent";
import { stamp } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabRouteName } from "../../navigation/routes";
import { TAB_ROUTES } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Filter = "all" | "unread";
type Bucket = "today" | "yesterday" | "earlier";

/** kind → градиент круглой иконки + глиф. Виды — реальные значения колонки
 *  `notifications.kind`; те же наборы путей, что на вебе. */
const KIND_STYLE: Record<string, { gradient: [string, string]; paths: string[] }> = {
  grade_received: { gradient: ["#34d399", "#059669"], paths: ["M20 6 9 17l-5-5"] },
  new_grade: { gradient: ["#34d399", "#059669"], paths: ["M20 6 9 17l-5-5"] },
  homework_graded: { gradient: ["#34d399", "#059669"], paths: ["M20 6 9 17l-5-5"] },
  new_homework: {
    gradient: ["#60a5fa", "#2563eb"],
    paths: ["M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z", "m8.5 12 2.5 2.5 5-5"],
  },
  student_submitted: {
    gradient: ["#60a5fa", "#2563eb"],
    paths: ["M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z", "m8.5 12 2.5 2.5 5-5"],
  },
  lesson_material: {
    gradient: ["#22d3ee", "#0891b2"],
    paths: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
  },
  lesson_created: {
    gradient: ["#a78bfa", "#7c3aed"],
    paths: ["M8 2v4", "M16 2v4", "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z", "M3 10h18"],
  },
  lesson_starting_soon: {
    gradient: ["#a78bfa", "#7c3aed"],
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  },
  student_excused: {
    gradient: ["#fbbf24", "#f97316"],
    paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  },
  announcement: {
    gradient: ["#f472b6", "#db2777"],
    paths: ["m3 11 18-7v16L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  },
};

const FALLBACK_STYLE = {
  gradient: ["#94a3b8", "#64748b"] as [string, string],
  paths: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
};

/**
 * kind → экран родительского приложения. Виды, для которых экрана нет,
 * сюда не попадают — карточка тогда не нажимается.
 *
 * Оценки живут на вкладке «Успехи» (p10), объявления — на d26, посещаемость
 * и уроки — в расписании (d15), домашние задания — на d12.
 */
const TARGET_BY_KIND: Record<string, keyof MainStackParamList | TabRouteName> = {
  grade_received: "p10",
  new_grade: "p10",
  homework_graded: "p10",
  new_homework: "d12",
  student_submitted: "d12",
  announcement: "d26",
  lesson_created: "d15",
  lesson_starting_soon: "d15",
  lesson_material: "d15",
  student_excused: "d14",
};

/** Круглая 38×38 иконка категории с градиентом и белым глифом. */
function CategoryIcon({ gradient, paths }: { gradient: [string, string]; paths: string[] }) {
  const g = gradPoints(135);
  return (
    <View style={[shadowStyle({ x: 0, y: 6, blur: 12, color: `${gradient[1]}44` }), { borderRadius: 19 }]}>
      <View style={{ width: 38, height: 38, borderRadius: 19, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <LinearGradient colors={gradient} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {paths.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </View>
    </View>
  );
}

/** Точка-маркер «непрочитано» 8×8. */
function UnreadDot({ visible }: { visible: boolean }) {
  const g = gradPoints(135);
  if (!visible) return <View style={{ width: 8, height: 8, marginTop: 4 }} />;
  return (
    <View style={[shadowStyle({ x: 0, y: 0, blur: 6, color: "rgba(124,58,237,0.5)" }), { borderRadius: 4, marginTop: 4 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, overflow: "hidden" }}>
        <LinearGradient colors={["#7c3aed", "#4f6df5"]} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      </View>
    </View>
  );
}

function SectionCap({ label }: { label: string }) {
  const { tokens } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, letterSpacing: 10.5 * 0.08, color: tokens.ink3 }}>
      {label}
    </Text>
  );
}

function NotificationCard({
  row,
  timeLabel,
  onPress,
}: {
  row: AppNotification;
  timeLabel: string;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  const style = KIND_STYLE[row.kind] ?? FALLBACK_STYLE;
  return (
    <GlassCard
      radius={18}
      onPress={onPress}
      contentStyle={{ padding: 11, paddingHorizontal: 13, flexDirection: "row", alignItems: "flex-start", gap: 10 }}
    >
      <CategoryIcon gradient={style.gradient} paths={style.paths} />
      <View style={{ flex: 1, minWidth: 0, flexDirection: "column", gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
            {row.title}
          </Text>
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>{timeLabel}</Text>
        </View>
        {row.body ? (
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, lineHeight: 10.5 * 1.45, color: tokens.ink2 }}>
            {row.body}
          </Text>
        ) : null}
      </View>
      <UnreadDot visible={!row.is_read} />
    </GlassCard>
  );
}

export default function NotificationsScreen() {
  const { d, locale } = useAppLocale();
  const m4 = d.parentApp.more4;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();

  const [filter, setFilter] = useState<Filter>("all");
  const state = useAsyncData(() => getMyNotifications(getSupabase(), 50), []);
  const rows = useMemo(() => state.data ?? [], [state.data]);

  const todayKey = useTashkentToday();
  const yesterdayKey = useMemo(() => addDays(todayKey, -1), [todayKey]);

  const shown = useMemo(
    () => (filter === "unread" ? rows.filter((n) => !n.is_read) : rows),
    [filter, rows],
  );

  const sections = useMemo(() => {
    const bucketOf = (iso: string): Bucket => {
      const key = tashkentDateKey(iso);
      if (key === todayKey) return "today";
      if (key === yesterdayKey) return "yesterday";
      return "earlier";
    };
    return (["today", "yesterday", "earlier"] as const)
      .map((bucket) => ({ bucket, rows: shown.filter((n) => bucketOf(n.created_at) === bucket) }))
      .filter((s) => s.rows.length > 0);
  }, [shown, todayKey, yesterdayKey]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: m4.notifFilterAll },
    { key: "unread", label: m4.notifFilterUnread },
  ];
  const activeIndex = Math.max(0, FILTERS.findIndex((f) => f.key === filter));

  const bucketLabel: Record<Bucket, string> = {
    today: d.parentApp.date.today.toUpperCase(),
    yesterday: d.parentApp.date.yesterday.toUpperCase(),
    earlier: d.parentApp.date.earlier.toUpperCase(),
  };

  function open(kind: string) {
    const target = TARGET_BY_KIND[kind];
    if (!target) return;
    if ((TAB_ROUTES as readonly string[]).includes(target)) {
      navigation.navigate("Tabs", { screen: target as TabRouteName });
      return;
    }
    navigation.navigate(target as never);
  }

  return (
    <AppBackground>
      <InnerHeader
        title={d.parentApp.scr.notifications}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        <SegmentPills
          items={FILTERS.map((f) => f.label)}
          activeIndex={activeIndex}
          onChange={(i) => setFilter(FILTERS[i].key)}
        />

        {state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : sections.length === 0 ? (
          <EmptyBlock
            title={filter === "unread" ? m4.notifUnreadEmptyTitle : m4.notifEmptyTitle}
            text={filter === "unread" ? m4.notifUnreadEmptyText : m4.notifEmptyText}
          />
        ) : (
          sections.map((section) => (
            <View key={section.bucket} style={{ gap: 11 }}>
              <SectionCap label={bucketLabel[section.bucket]} />
              {section.rows.map((n) => (
                <NotificationCard
                  key={n.id}
                  row={n}
                  timeLabel={stamp(n.created_at, todayKey, yesterdayKey, localeTag, d.parentApp.date.yesterday)}
                  onPress={TARGET_BY_KIND[n.kind] ? () => open(n.kind) : undefined}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </AppBackground>
  );
}
