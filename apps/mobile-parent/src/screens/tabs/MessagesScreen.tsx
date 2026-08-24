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
 * ЧЕГО БОЛЬШЕ НЕТ. Личных переписок с учителями: чата у школы пока нет, и
 * выдуманные диалоги убраны совсем. Вместо них — честная строка о том, что
 * появится позже; сам экран переписки (d25) тоже стал «Скоро».
 */
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { GlassCard, RootHeader, TabScreenScroll } from "../../ui";
import { useAppLocale } from "../../i18n";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { useDemoSession } from "../../context/DemoSessionContext";
import { getGroupSubjectTeachers } from "@snr/core";
import { getMessageThreads } from "../../data";
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

  // 23.08.2026. В демо вкладка не может быть полупустой: заказчик показывает,
  // как приложение будет выглядеть. Поэтому под настоящими объявлениями и
  // новостями появляется список личных переписок — но только в демо; у
  // настоящего родителя ниже по-прежнему честная строка «Скоро».
  // Собеседники — НАСТОЯЩИЕ учителя ребёнка, те же, что в «Предметах»:
  // выдуманных имён в демо-переписке быть не должно.
  const { isDemo } = useDemoSession();
  const { child, childId } = useChildScope();
  const teachers = useChildQuery(childId, (db) =>
    child?.group_id ? getGroupSubjectTeachers(db, child.group_id) : Promise.resolve([]),
  );
  const chatPeers = (teachers.data ?? []).filter((x) => x.teacherName).slice(0, 3);
  // Превью — первая реплика той же переписки, которую открывает строка.
  const chatPreview = getMessageThreads(locale).find((x) => x.category === "chats")?.preview ?? "";

  return (
    <AppBackground>
      <RootHeader
        title={t.nav.messages}
        titleSize={17}
        bellCount={bellCount}
        onBellPress={() => navigation.navigate("d8")}
      />

      <TabScreenScroll style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}>
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
        </GlassCard>

        {/* В демо — список личных переписок с настоящими учителями. Вне демо
            личных переписок в школе нет, и мы говорим это прямо, а не
            показываем выдуманные диалоги. */}
        {isDemo && chatPeers.length > 0 ? (
          <GlassCard radius={22} contentStyle={{ paddingHorizontal: 14, paddingVertical: 2 }}>
            {chatPeers.map((peer, i) => (
              <SectionRow
                key={peer.subjectId}
                icon="chat"
                gradient={["#22d3ee", "#0891b2"]}
                title={peer.teacherName ?? ""}
                subtitle={`${peer.subjectName} · ${chatPreview}`}
                onPress={() => navigation.navigate("d25")}
                divider={i > 0}
              />
            ))}
          </GlassCard>
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
