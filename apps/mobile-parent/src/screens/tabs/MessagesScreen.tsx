/**
 * Экран d24 «Сообщения» — корневой таб, перенос 1:1 из макета
 * «SNR EduOS v2 Light.dc.html», строки 747–766. Заход 4a редизайна v2.
 *
 * Порядок блоков (по block-list):
 *  1. Шапка: заголовок «Сообщения» (Unbounded 17/600) + glass-кнопки
 *     Поиск (→ da6) и Написать (→ stub:compose). padding 46/18/8.
 *  2. Горизонтальная лента сториз (5 круглых 54×54): «Важные»,
 *     «Кл. руковод.» (СУ), «Математика» (ГЮ), «Английский» (НА),
 *     «Администрация». Инициалы — с зелёной точкой онлайн; иконки —
 *     на градиенте с двойным белым кольцом.
 *  3. SegmentPills 4 таба «Все / Чаты / Объявления / Сервисы».
 *     На «Сервисы» — красная точка-бейдж (dotIndexes={[3]}).
 *  4. Список тредов: карточки-стекло, каждая — icon/аватар + row
 *     (name, role-chip, time справа) + row (preview 2 строки, badge справа).
 *     Фильтрация по выбранной вкладке.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Avatar,
  CountBadge,
  GlassCard,
  GlassCircleButton,
  SegmentPills,
} from "../../ui";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { useAppLocale } from "../../i18n";
import { getMessageThreads, getMessagesStories } from "../../data";
import type { MessagesStoryRow, MessageThreadRow } from "../../data/types";
import { ICONS, STUBS, type MainStackParamList, type StubKey } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Cat = "all" | MessageThreadRow["category"];

const CATEGORIES: Cat[] = ["all", "chats", "ann", "svc"];

const CAT_LABEL_KEY: Record<Cat, "tabAll" | "tabChats" | "tabAnn" | "tabSvc"> = {
  all: "tabAll",
  chats: "tabChats",
  ann: "tabAnn",
  svc: "tabSvc",
};

export default function MessagesScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<Cat>("all");

  const stories = getMessagesStories();
  const threads = useMemo<MessageThreadRow[]>(
    () => (category === "all" ? getMessageThreads() : getMessageThreads(category)),
    [category],
  );

  const tabItems = CATEGORIES.map((c) => d.parentApp.msg[CAT_LABEL_KEY[c]]);

  const goRoute = (go: string) => {
    if (go.startsWith("stub:")) {
      const key = go.slice("stub:".length) as StubKey;
      if (STUBS[key]) navigation.navigate("stub", { stubKey: key });
      return;
    }
    navigation.navigate(go as keyof MainStackParamList as never);
  };

  return (
    <AppBackground>
      {/* 1. Шапка: заголовок + Поиск + Написать (46/18/8). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.unbounded600,
            fontSize: 17,
            color: tokens.ink1,
          }}
        >
          {d.parentApp.nav.messages}
        </Text>
        <GlassCircleButton onPress={() => navigation.navigate("da6")}>
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.ink1}
            strokeWidth={2}
            strokeLinecap="round"
          >
            {ICONS.search.map((path, i) => (
              <Path key={i} d={path} />
            ))}
          </Svg>
        </GlassCircleButton>
        <GlassCircleButton
          onPress={() => navigation.navigate("stub", { stubKey: "compose" })}
        >
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.ink1}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M12 20h9" />
            <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </Svg>
        </GlassCircleButton>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 118, gap: 11 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Горизонтальная лента сториз. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingVertical: 4,
            gap: 12,
          }}
        >
          {stories.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => goRoute(s.go)}
              style={{ alignItems: "center", gap: 4, width: 56 }}
            >
              <StoryCircle story={s} />
              <Text
                numberOfLines={1}
                style={{
                  width: 56,
                  fontFamily: fonts.manrope700,
                  fontSize: 8,
                  color: tokens.ink2,
                  textAlign: "center",
                }}
              >
                {(d.parentApp.msg as Record<string, string>)[s.label_key] ?? s.label_key}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* 3. SegmentPills — 4 таба, красная точка на «Сервисы». */}
        <View style={{ paddingHorizontal: 18 }}>
          <SegmentPills
            items={tabItems}
            activeIndex={CATEGORIES.indexOf(category)}
            onChange={(i) => setCategory(CATEGORIES[i])}
            dotIndexes={[3]}
          />
        </View>

        {/* 4. Список тредов — отдельные glass-карточки. */}
        <View style={{ paddingHorizontal: 18, gap: 11 }}>
          {threads.map((m) => (
            <ThreadCard
              key={`${m.category}-${m.name}`}
              row={m}
              onPress={() => goRoute(m.go)}
            />
          ))}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

/* ═══ Story-круг 54×54: наружный градиент 2.5 + белый зазор 2 ═══ */

function StoryCircle({ story }: { story: MessagesStoryRow }) {
  const SIZE = 54;
  if (story.kind === "chat" && story.initials) {
    return (
      <Avatar
        variant="story"
        size={SIZE}
        initials={story.initials}
        gradient={story.gradient}
        online={story.is_online}
        onlineSize={12}
      />
    );
  }
  const iconPaths = story.icon_key ? ICONS[story.icon_key] : undefined;
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <LinearGradient
        colors={story.gradient}
        {...gradPoints(135)}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          padding: 2.5,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: SIZE / 2,
            padding: 2,
            backgroundColor: "#fff",
          }}
        >
          <LinearGradient
            colors={story.gradient}
            {...gradPoints(135)}
            style={{
              flex: 1,
              borderRadius: (SIZE - 9) / 2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {iconPaths ? (
              <Svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {iconPaths.map((p, i) => (
                  <Path key={i} d={p} />
                ))}
              </Svg>
            ) : null}
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

/* ═══ Карточка треда: аватар + name/role/time + preview/badge ═══ */

function ThreadCard({ row, onPress }: { row: MessageThreadRow; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <GlassCard
      onPress={onPress}
      contentStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11,
        paddingHorizontal: 13,
      }}
    >
      <ThreadAvatar row={row} />

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {/* Верх: имя + role-чип + время. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontFamily: fonts.manrope800,
              fontSize: 12.5,
              color: tokens.ink1,
            }}
          >
            {row.name}
          </Text>
          {row.role_label ? <RoleChip label={row.role_label} /> : null}
          <View style={{ flex: 1 }} />
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

        {/* Низ: preview + badge. */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10.5,
              lineHeight: 15,
              color: tokens.ink2,
            }}
          >
            {row.preview}
          </Text>
          {row.badge ? <CountBadge value={row.badge} preset="accent" size={17} /> : null}
        </View>
      </View>
    </GlassCard>
  );
}

/** Аватар треда: 42×42 круг с инициалами (+online) или квадрат-градиент r13 с иконкой. */
function ThreadAvatar({ row }: { row: MessageThreadRow }) {
  const SIZE = 42;
  const grad: [string, string] = row.avatar_gradient ?? ["#8b5cf6", "#6366f1"];
  if (row.avatar_initials) {
    return (
      <Avatar
        size={SIZE}
        variant="ring"
        initials={row.avatar_initials}
        gradient={grad}
        online={row.is_online}
        onlineSize={11}
      />
    );
  }
  const iconPaths = row.avatar_icon_key ? ICONS[row.avatar_icon_key] : ICONS.chat;
  return (
    <LinearGradient
      colors={grad}
      {...gradPoints(135)}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {iconPaths.map((p, i) => (
          <Path key={i} d={p} />
        ))}
      </Svg>
    </LinearGradient>
  );
}

/** Мини-чип роли (Учитель / Куратор 7-А) — 8.5/800, r999. */
function RoleChip({ label }: { label: string }) {
  const { tokens } = useTheme();
  const c = tokens.status.violet;
  const chip = tokens.chip(c.rgb);
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 999,
        backgroundColor: chip.bg,
        borderColor: chip.border,
        borderWidth: 1,
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 8.5,
          color: c.text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
