/**
 * П8 «Уведомления» — Заход 5, block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 686–702.
 *
 * Порядок блоков (block-list):
 *  687–690 InnerHeader (glass-back + Unbounded 15 title)
 *  691     ScrollView контейнер (gap 11, padding 4 18 118)
 *  692     ряд фильтр-чипов «Все / Непрочитанные / Важные» (SegmentPills)
 *  693     секционный хедер «СЕГОДНЯ» (ntTodayHdr)
 *  694–696 карточки за сегодня (ntToday sc-for, GlassCard-стиль ntList)
 *  697     секционный хедер «ВЧЕРА» (ntYdayHdr)
 *  698–700 карточки за вчера (ntYday sc-for)
 *
 * Данные — только через фикстуры (getNotifications). Иконка карточки —
 * круг 38×38 с градиентом n.gradient и белыми path'ами (макет строка 3604).
 * Точка n.dot — 8×8 фиолетовый gradient при is_unread, иначе прозрачная
 * (макет строка 3607). Секции скрываются, если после фильтра пусто (макет
 * строка 3612 ntHdr → display:none).
 *
 * i18n: заголовок из d.parentApp.scr.notifications; секции — date.today/
 * yesterday в uppercase; чипы фильтров используют pay.all и msg.storyImportant,
 * «Непрочитанные» — литерал (соответствующего parentApp-ключа в словаре нет,
 * как и у HOMEWORK_FILTER_CHIPS). Обе темы через useTheme().
 * iOS safe-area — из InnerHeader; нижний отступ 118 под FloatingTabBar.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, InnerHeader, SegmentPills } from "../../ui";
import { getNotifications } from "../../data";
import type { NotificationRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Filter = "all" | "unread" | "important";

/** Иконка категории 38×38 rounded-50 с градиентом и белыми SVG-path'ами
 *  (макет строка 3604: bg linear-gradient 135°, boxShadow 0 6 12 c[1]44). */
function CategoryIcon({
  gradient,
  paths,
}: {
  gradient: [string, string];
  paths?: string[];
}) {
  const g = gradPoints(135);
  // Тень «0 6 12 g[1]44» ≈ hex-α 44 (≈0.27).
  const shadow = { x: 0, y: 6, blur: 12, color: `${gradient[1]}44` };
  return (
    <View style={[shadowStyle(shadow), { borderRadius: 19 }]}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LinearGradient
          colors={gradient}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        {paths && paths.length > 0 ? (
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {paths.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

/** Точка-маркер «непрочитано» 8×8 (макет строка 3607). */
function UnreadDot({ visible }: { visible: boolean }) {
  if (!visible) {
    return <View style={{ width: 8, height: 8, marginTop: 4 }} />;
  }
  const g = gradPoints(135);
  return (
    <View style={[shadowStyle({ x: 0, y: 0, blur: 6, color: "rgba(124,58,237,0.5)" }), { borderRadius: 4, marginTop: 4 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, overflow: "hidden" }}>
        <LinearGradient
          colors={["#7c3aed", "#4f6df5"]}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

/** Иконка категории по маршруту go/оттенку — используем path'ы из ICONS.
 *  В фикстуре хранится только цвет; глиф выбираем по семантике go, как в
 *  ntData макета (строки 3562–3570). */
function iconPathsFor(n: NotificationRow): string[] {
  switch (n.go) {
    case "p10":
      return ["M20 6 9 17l-5-5"]; // check (оценка)
    case "d12":
      return [
        "M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z",
        "m8.5 12 2.5 2.5 5-5",
      ]; // check-square (ДЗ)
    case "d18":
      return [
        "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
        "M14 3v5h5",
        "M9 13h6",
        "M9 17h4",
      ]; // doc (счёт)
    case "d20":
      return [
        "M20 12V8H6a2 2 0 0 1 0-4h12v4",
        "M4 6v12a2 2 0 0 0 2 2h14v-6",
        "M18 12a2 2 0 0 0 0 4h4v-4Z",
      ]; // wallet (платёж)
    case "d14":
      return ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"]; // clock (посещаемость)
    case "stub:announce":
      return ["m3 11 18-7v16L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"]; // megaphone
    default:
      return ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]; // bell
  }
}

/** Одна карточка уведомления (макет строки 695/699 + стиль ntList 3601). */
function NotificationCard({
  row,
  onPress,
}: {
  row: NotificationRow;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <GlassCard
      radius={18}
      onPress={onPress}
      contentStyle={{
        padding: 11,
        paddingHorizontal: 13,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <CategoryIcon gradient={row.gradient as [string, string]} paths={iconPathsFor(row)} />
      <View style={{ flex: 1, minWidth: 0, flexDirection: "column", gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: fonts.manrope800,
              fontSize: 12,
              color: tokens.ink1,
            }}
          >
            {row.title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 9,
              color: tokens.ink3,
            }}
          >
            {row.time_label}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 10.5,
            lineHeight: 10.5 * 1.45,
            color: tokens.ink2,
          }}
        >
          {row.body}
        </Text>
      </View>
      <UnreadDot visible={row.is_unread} />
    </GlassCard>
  );
}

/** Секционный хедер uppercase 10.5/800 letterSpacing .08em ink3
 *  (макет строка 3613 ntHdr). */
function SectionCap({ label }: { label: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        color: tokens.ink3,
      }}
    >
      {label}
    </Text>
  );
}

export default function NotificationsScreen() {
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  // ntF: 'all' | 'unread' | 'imp' (макет строка 3901).
  const [filter, setFilter] = useState<Filter>("all");

  const today = getNotifications("today");
  const yday = getNotifications("yday");

  const matches = (n: NotificationRow): boolean => {
    if (filter === "all") return true;
    if (filter === "unread") return n.is_unread;
    return n.is_important;
  };

  const todayShown = useMemo(() => today.filter(matches), [today, filter]);
  const ydayShown = useMemo(() => yday.filter(matches), [yday, filter]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: d.parentApp.pay.all },
    { key: "unread", label: "Непрочитанные" },
    { key: "important", label: d.parentApp.msg.storyImportant },
  ];

  const activeIndex = FILTERS.findIndex((f) => f.key === filter);

  return (
    <AppBackground>
      {/* 687–690: InnerHeader (glass back + Unbounded 15 title). */}
      <InnerHeader
        title={d.parentApp.scr.notifications}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
      />

      {/* 691: скролл-контейнер списка. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* 692: ряд фильтр-чипов (Все / Непрочитанные / Важные). */}
        <SegmentPills
          items={FILTERS.map((f) => f.label)}
          activeIndex={activeIndex < 0 ? 0 : activeIndex}
          onChange={(i) => setFilter(FILTERS[i].key)}
        />

        {/* 693 + 694–696: секция «СЕГОДНЯ» + карточки. */}
        {todayShown.length > 0 ? (
          <>
            <SectionCap label={d.parentApp.date.today.toUpperCase()} />
            {todayShown.map((n, idx) => (
              <NotificationCard
                key={`today-${idx}`}
                row={n}
                onPress={() => {
                  if (n.go.indexOf("stub:") === 0) return;
                  navigation.navigate(n.go as never);
                }}
              />
            ))}
          </>
        ) : null}

        {/* 697 + 698–700: секция «ВЧЕРА» + карточки. */}
        {ydayShown.length > 0 ? (
          <>
            <SectionCap label={d.parentApp.date.yesterday.toUpperCase()} />
            {ydayShown.map((n, idx) => (
              <NotificationCard
                key={`yday-${idx}`}
                row={n}
                onPress={() => {
                  if (n.go.indexOf("stub:") === 0) return;
                  navigation.navigate(n.go as never);
                }}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}
