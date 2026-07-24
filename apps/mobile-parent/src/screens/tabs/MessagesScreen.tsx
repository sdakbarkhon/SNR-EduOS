/**
 * Экран d24 «Сообщения» — корневой таб (перенос 1:1 из макета,
 * строки 747–766, разведка recon-tabs §4).
 *
 * Композиция сверху вниз:
 *  1. Шапка (без лого): заголовок «Сообщения» Unbounded 17 + flex + две
 *     glass-кнопки 38 (search → da6, edit → stub 'compose'). Без bell/аватара.
 *  2. Горизонтальный story-picker: 5 круглых элементов ~64×64 с двойным кольцом
 *     (accent-градиент 2.5px + белый зазор 2px), внутри — либо инициалы
 *     учителя (+ online-dot), либо белая иконка на градиенте. Данные —
 *     getMessagesStories(); подписи под кругом — parentApp.msg.story*.
 *  3. SegmentPills 4 таба «Все / Чаты / Объявления / Сервисы» (local state).
 *     У «Сервисы» — красная точка-бейдж (dotIndexes={[3]}).
 *  4. Список тредов: фильтруется по выбранной вкладке
 *     (all → без фильтра; chats/ann/svc → getMessageThreads(category)).
 *     Каждый ряд — ListRow с аватаром/иконкой (avatar_gradient/initials/
 *     avatar_icon_key), preview, time, badge → навигация по m.go
 *     (ключ маршрута или «stub:key»).
 *
 * Никаких Ring/RingSegmented/Sparkline/Radar на экране не используется.
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
  ListRow,
  SegmentPills,
} from "../../ui";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { useAppLocale } from "../../i18n";
import { getMessageThreads, getMessagesStories } from "../../data";
import type { MessagesStoryRow, MessageThreadRow } from "../../data/types";
import type { MainStackParamList } from "../../navigation/routes";
import { ICONS, STUBS, type StubKey } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Cat = "all" | MessageThreadRow["category"];

const CATEGORIES: Cat[] = ["all", "chats", "ann", "svc"];

/** Ключ i18n подписи вкладки. */
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

  const goThread = (go: string) => {
    if (go.startsWith("stub:")) {
      const key = go.slice("stub:".length) as StubKey;
      if (STUBS[key]) navigation.navigate("stub", { stubKey: key });
      return;
    }
    navigation.navigate(go as keyof MainStackParamList as never);
  };

  const goStory = (s: MessagesStoryRow) => {
    if (s.go.startsWith("stub:")) {
      const key = s.go.slice("stub:".length) as StubKey;
      if (STUBS[key]) navigation.navigate("stub", { stubKey: key });
      return;
    }
    navigation.navigate(s.go as keyof MainStackParamList as never);
  };

  return (
    <AppBackground>
      {/* Шапка d24: без bell/аватара, две glass-кнопки справа. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 17, color: tokens.ink1 }}>
          {d.parentApp.nav.messages}
        </Text>
        <View style={{ flex: 1 }} />
        <GlassCircleButton onPress={() => navigation.navigate("da6")}>
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {ICONS.search.map((d, i) => <Path key={i} d={d} />)}
          </Svg>
        </GlassCircleButton>
        <GlassCircleButton onPress={() => navigation.navigate("stub", { stubKey: "compose" })}>
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 20h9" />
            <Path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
          </Svg>
        </GlassCircleButton>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Story-picker (горизонтальный скролл). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingVertical: 6 }}
        >
          {stories.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => goStory(s)}
              style={{ alignItems: "center", gap: 6, width: 68 }}
            >
              <StoryCircle story={s} />
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 9.5,
                  color: tokens.ink1,
                  textAlign: "center",
                }}
              >
                {d.parentApp.msg[s.label_key as keyof typeof d.parentApp.msg] ?? s.label_key}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* 3. Табы категорий (badge-dot на «Сервисы» — 3-й индекс). */}
        <View style={{ paddingHorizontal: 18 }}>
          <SegmentPills
            items={tabItems}
            activeIndex={CATEGORIES.indexOf(category)}
            onChange={(i) => setCategory(CATEGORIES[i])}
            dotIndexes={[3]}
          />
        </View>

        {/* 4. Список тредов. */}
        <View style={{ paddingHorizontal: 18, marginTop: 2 }}>
          <GlassCard contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {threads.map((m, i) => (
              <ListRow
                key={m.name}
                left={<ThreadAvatar row={m} />}
                title={m.name}
                subtitle={m.preview}
                right={
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink3 }}>
                      {m.time_label}
                    </Text>
                    {m.badge ? <CountBadge value={m.badge} preset="accent" /> : null}
                  </View>
                }
                divider={i > 0}
                gap={11}
                verticalPadding={10}
                onPress={() => goThread(m.go)}
              />
            ))}
          </GlassCard>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

/** Круг-стория 64×64: наружное градиентное кольцо + белый зазор + внутренний круг. */
function StoryCircle({ story }: { story: MessagesStoryRow }) {
  const SIZE = 64;
  if (story.kind === "chat" && story.initials) {
    return (
      <Avatar
        variant="story"
        size={SIZE}
        initials={story.initials}
        gradient={story.gradient}
        online={story.is_online}
        onlineSize={11}
      />
    );
  }
  // Icon-стория: сам ставим двойное кольцо и рендерим иконку на градиенте.
  const g = gradPoints(135);
  const iconPaths = story.icon_key ? ICONS[story.icon_key] : undefined;
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <LinearGradient
        colors={story.gradient}
        {...g}
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
            {...g}
            style={{
              flex: 1,
              borderRadius: (SIZE - 9) / 2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {iconPaths ? (
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                {iconPaths.map((d, i) => <Path key={i} d={d} />)}
              </Svg>
            ) : null}
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

/** Аватар/иконка треда в ListRow: 42×42 круг или rounded-13 квадрат-градиент. */
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
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {iconPaths.map((d, i) => <Path key={i} d={d} />)}
      </Svg>
    </LinearGradient>
  );
}

