/**
 * Вкладка «Сообщения» — раздел ЧАСТИЧНО живой, поэтому не заменён на «Скоро».
 *
 * ЧТО БЫЛО ДО 16.08.2026. Лента «сториз» и список из семи выдуманных
 * переписок («Гульнора Юсупова», «И поздравляю Малику с пятёркой…») с плашкой
 * «это пример» сверху. Ни одно сообщение не было настоящим.
 *
 * ЧТО ОСТАЛОСЬ. Ровно то, что живёт на настоящих данных: объявления школы и
 * новости от администрации — оба экрана читают базу и работают. Их и
 * показываем, с непрочитанными из того же счётчика, что и колокольчик.
 *
 * ЧЕГО БОЛЬШЕ НЕТ У НАСТОЯЩЕГО РОДИТЕЛЯ. Личных переписок с учителями:
 * чата у школы пока нет, и выдуманные диалоги убраны совсем. Вместо них —
 * честная строка о том, что появится позже.
 *
 * ВИТРИНА (30.08.2026). В показе вкладка собрана по макету, разметка
 * 747–767: лента «важных» кружками, четыре чипа фильтра и восемь строк
 * переписок. Заготовки для всего этого лежали в messages.ts с самого
 * начала — не хватало только ветки, которая их покажет.
 *
 * До этого захода показ ходил сюда в базу за настоящими учителями ребёнка
 * (getGroupSubjectTeachers) и рисовал из них три строки. После захода 1
 * родителя в показе нет вовсе, запрос возвращал пустоту, и вкладка
 * показывала «Скоро». Запрос убран: показу он не нужен, а настоящему
 * родителю не был нужен никогда — эти строки рисовались только в демо.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { GlassCard, RootHeader, TabScreenScroll } from "../../ui";
import { useAppLocale } from "../../i18n";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { useDemoSession } from "../../context/DemoSessionContext";
import { getMessageStories, getMessageThreads } from "../../data";
import type { MessageThreadRow } from "../../data";
import { ICONS } from "../../navigation/routes";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Строка раздела: цветная плитка + название + подпись + шеврон. */
function SectionRow({
  icon,
  gradient,
  title,
  subtitle,
  onPress,
  divider,
}: {
  icon: string;
  gradient: [string, string];
  title: string;
  subtitle: string;
  onPress: () => void;
  divider: boolean;
}) {
  const { tokens, scheme } = useTheme();
  const g = gradPoints(135);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
          borderTopWidth: divider ? 1 : 0,
          borderTopColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.07)",
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={g.start}
        end={g.end}
        style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
      >
        <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {(ICONS[icon] ?? ICONS.doc).map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </LinearGradient>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
          {title}
        </Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink2 }}>
          {subtitle}
        </Text>
      </View>

      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
          d="m9 18 6-6-6-6"
          stroke={scheme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(26,19,74,0.4)"}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const bellCount = useUnreadNotifications();

  const soon = t.soon2.items.chatList ?? t.soon2.fallback;

  const { isDemo } = useDemoSession();

  // Витрина: ленты и переписки из заготовок. В базу отсюда не ходим вовсе —
  // ни за учителями, ни за чем-либо ещё.
  const [msgFilter, setMsgFilter] = useState<"all" | MessageThreadRow["category"]>("all");
  const stories = getMessageStories();
  const threads = getMessageThreads(locale);
  const shownThreads = msgFilter === "all" ? threads : threads.filter((x) => x.category === msgFilter);
  const MSG_FILTERS = [
    { key: "all" as const, label: t.msg.tabAll },
    { key: "chats" as const, label: t.msg.tabChats },
    { key: "ann" as const, label: t.msg.tabAnn },
    { key: "svc" as const, label: t.msg.tabSvc },
  ];

  return (
    <AppBackground>
      <RootHeader
        title={t.nav.messages}
        titleSize={17}
        bellCount={bellCount}
        onBellPress={() => navigation.navigate("d8")}
      />

      <TabScreenScroll style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}>
        {/* Лента «важных» кружками (разметка 755–759) — только показ. */}
        {isDemo ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
            {stories.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => navigation.navigate(s.go as never)}
                style={{ alignItems: "center", gap: 5, width: 60 }}
              >
                <View style={{ position: "relative" }}>
                  <LinearGradient
                    colors={[s.gradient[0], s.gradient[1]]}
                    {...gradPoints(135)}
                    style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }}
                  >
                    {s.kind === "chat" ? (
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>{s.initials}</Text>
                    ) : (
                      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round">
                        {(ICONS[s.icon_key ?? "mega"] ?? []).map((p, i) => (
                          <Path key={i} d={p} />
                        ))}
                      </Svg>
                    )}
                  </LinearGradient>
                  {s.is_online ? (
                    <View
                      style={{
                        position: "absolute",
                        right: 1,
                        bottom: 1,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: "#22c55e",
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                      }}
                    />
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink2, textAlign: "center" }}
                >
                  {t.msg[s.label_key as keyof typeof t.msg] as string}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <GlassCard radius={22} contentStyle={{ paddingHorizontal: 14, paddingVertical: 2 }}>
          <SectionRow
            icon="mega"
            gradient={["#a78bfa", "#7c3aed"]}
            title={t.scr.announcements}
            subtitle={t.msg.announcementsSub}
            onPress={() => navigation.navigate("d26")}
            divider={false}
          />
          <SectionRow
            icon="mega"
            gradient={["#60a5fa", "#2563eb"]}
            title={t.scr.adminNews}
            subtitle={t.msg.adminNewsSub}
            onPress={() => navigation.navigate("d27")}
            divider
          />
          {/* ПОДДЕРЖКА — ТОЛЬКО ВНЕ ДЕМО. Значок непрочитанного на этой
              вкладке считает все переписки, включая комнату поддержки, а
              попасть отсюда в неё было некуда: красный кружок вёл в никуда.
              Демо-гостю строка не показывается — его карточка остаётся ровно
              из двух строк, какой была. */}
          {!isDemo ? (
            <SectionRow
              icon="chat"
              gradient={["#60a5fa", "#2563eb"]}
              title={t.msg.supportRealTitle}
              subtitle={t.msg.supportRealSub}
              onPress={() => navigation.navigate("d28")}
              divider
            />
          ) : null}
        </GlassCard>

        {/* Показ — восемь переписок макета с чипами фильтра. Вне показа
            личных переписок в школе нет, и мы говорим это прямо, а не
            показываем выдуманные диалоги. */}
        {isDemo ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {MSG_FILTERS.map((fl) => {
                const on = msgFilter === fl.key;
                return (
                  <Pressable
                    key={fl.key}
                    onPress={() => setMsgFilter(fl.key)}
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 13,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? tokens.accent : tokens.glassBorder,
                      backgroundColor: on ? tokens.accent : "rgba(255,255,255,0.55)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 11,
                        color: on ? "#FFFFFF" : tokens.ink2,
                      }}
                    >
                      {fl.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <GlassCard radius={22} contentStyle={{ paddingHorizontal: 13, paddingVertical: 2 }}>
              {shownThreads.map((th, i) => (
                <Pressable
                  key={th.name}
                  onPress={() => navigation.navigate(th.go as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                    paddingVertical: 11,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <View style={{ position: "relative" }}>
                    <LinearGradient
                      colors={[th.avatar_gradient?.[0] ?? "#a78bfa", th.avatar_gradient?.[1] ?? "#7c3aed"]}
                      {...gradPoints(135)}
                      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
                    >
                      {th.avatar_initials ? (
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>
                          {th.avatar_initials}
                        </Text>
                      ) : (
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round">
                          {(ICONS[th.avatar_icon_key ?? "chat"] ?? []).map((p, k) => (
                            <Path key={k} d={p} />
                          ))}
                        </Svg>
                      )}
                    </LinearGradient>
                    {th.is_online ? (
                      <View
                        style={{
                          position: "absolute",
                          right: 0,
                          bottom: 0,
                          width: 11,
                          height: 11,
                          borderRadius: 6,
                          backgroundColor: "#22c55e",
                          borderWidth: 2,
                          borderColor: "#FFFFFF",
                        }}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                        {th.name}
                      </Text>
                      {th.role_label ? (
                        <View
                          style={{
                            paddingVertical: 2,
                            paddingHorizontal: 7,
                            borderRadius: 999,
                            backgroundColor: tokens.chip(tokens.status.violet.rgb).bg,
                            borderWidth: 1,
                            borderColor: tokens.chip(tokens.status.violet.rgb).border,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, color: tokens.status.violet.text }}>
                            {th.role_label}
                          </Text>
                        </View>
                      ) : null}
                      <View style={{ flex: 1 }} />
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                        {th.time_label}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2 }}>
                        {th.preview}
                      </Text>
                      {th.badge ? (
                        <View
                          style={{
                            minWidth: 18,
                            height: 18,
                            paddingHorizontal: 5,
                            borderRadius: 9,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: tokens.accent,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: "#FFFFFF" }}>{th.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              ))}
            </GlassCard>
          </>
        ) : (
        <GlassCard radius={20} contentStyle={{ padding: 16, gap: 7, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1, textAlign: "center" }}>
            {soon.title}
          </Text>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 17, color: tokens.ink2, textAlign: "center" }}>
            {soon.text}
          </Text>
          <View
            style={{
              marginTop: 4,
              paddingVertical: 5,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: tokens.chip(tokens.status.violet.rgb).bg,
              borderWidth: 1,
              borderColor: tokens.chip(tokens.status.violet.rgb).border,
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: tokens.status.violet.text }}>
              {t.soon2.badge}
            </Text>
          </View>
        </GlassCard>
        )}
      </TabScreenScroll>
    </AppBackground>
  );
}
