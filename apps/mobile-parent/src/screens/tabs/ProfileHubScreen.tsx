/**
 * Экран dhub «Профиль-хаб» — корневой таб (перенос 1:1 из макета,
 * строки 1132–1164, разведка recon-tabs §5).
 *
 * Композиция сверху вниз:
 *  1. Шапка (без bell/аватара): заголовок «Профиль» Unbounded 15 + flex +
 *     одна glass-кнопка 38 (sliders → d34 «Язык и безопасность»).
 *  2. Карточка родителя (GlassCard r22): аватар 54 с двойным кольцом (белый 2
 *     + фиолетовый 2.5) + инициалы + ФИО + role_label «Родитель» + телефон + шеврон → d30.
 *  3. SectionHeader «Мои дети».
 *  4. GlassCard-list детей — по одной строке на CHILDREN: аватар 36 с ring,
 *     ФИО + класс, StatusChip (green «В школе» / gray «Дома»), шеврон → d29.
 *  5. SectionHeader «Настройки».
 *  6. GlassCard-list из 4 строк — Documents/Notifications/PayMethods/LangSec.
 *  7. SectionHeader «Поддержка».
 *  8. GlassCard-list из 2 строк — Help/About.
 *  9. Кнопка «Выйти» — border-red 1.5, red text (открывает CenterModalFrame
 *     подтверждения — CONFIRM_DIALOGS.logout).
 * 10. Подпись «SNR EduOS · версия {v}» из app.json (Constants.expoConfig.version).
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import { useAuthSession } from "../../context/AuthSessionContext";
import {
  Avatar,
  CenterModalFrame,
  GlassCard,
  GlassCircleButton,
  PrimaryButton,
  SectionHeader,
  StatusChip,
} from "../../ui";
import { AppBackground, fonts, gradPoints, useTheme, type ThemeTokens } from "../../theme";
import { useAppLocale } from "../../i18n";
import {
  getChildren,
  getConfirmDialog,
  getParent,
} from "../../data";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Пункт меню (Настройки/Поддержка). */
interface HubMenuItem {
  key: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
  iconPaths: string[];
  route: keyof MainStackParamList;
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export default function ProfileHubScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [logoutOpen, setLogoutOpen] = useState(false);
  const { signOut } = useAuthSession();

  const parent = getParent();
  const children = getChildren();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const logoutDialog = getConfirmDialog("logout");

  const settingsItems: HubMenuItem[] = [
    {
      key: "docs",
      title: d.parentApp.scr.documents,
      subtitle: d.parentApp.prof.docsSub,
      gradient: ["#60a5fa", "#2563eb"],
      iconPaths: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
      route: "d31",
    },
    {
      key: "notifSet",
      title: d.parentApp.scr.notifSettings,
      subtitle: d.parentApp.prof.notifSetSub,
      gradient: ["#fbbf24", "#f97316"],
      iconPaths: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
      route: "d32",
    },
    {
      key: "payMeth",
      title: d.parentApp.scr.payMethods,
      subtitle: d.parentApp.prof.payMethodsSub,
      gradient: ["#a78bfa", "#7c3aed"],
      iconPaths: ["M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z", "M2 10h20"],
      route: "d33",
    },
    {
      key: "langSec",
      title: d.parentApp.scr.langSec,
      subtitle: d.parentApp.prof.langSecSub,
      gradient: ["#22d3ee", "#0891b2"],
      iconPaths: [
        "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
        "M3 12h18",
        "M12 3a13 13 0 0 1 0 18",
        "M12 3a13 13 0 0 0 0 18",
      ],
      route: "d34",
    },
  ];

  const supportItems: HubMenuItem[] = [
    {
      key: "support",
      title: d.parentApp.prof.helpTitle,
      subtitle: d.parentApp.prof.helpSub,
      gradient: ["#f472b6", "#db2777"],
      iconPaths: [
        "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
        "M9 10a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7",
        "M12 17h.01",
      ],
      route: "d28",
    },
    {
      key: "about",
      title: d.parentApp.scr.about,
      subtitle: d.parentApp.prof.aboutSub,
      gradient: ["#94a3b8", "#64748b"],
      iconPaths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8h.01", "M11 12h1v4h1"],
      route: "da7",
    },
  ];

  const goTo = (r: keyof MainStackParamList) => () => navigation.navigate(r as never);

  return (
    <AppBackground>
      {/* Шапка dhub. */}
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
        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1 }}>
          {d.parentApp.nav.profile}
        </Text>
        <View style={{ flex: 1 }} />
        <GlassCircleButton onPress={goTo("d34")}>
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 6h18" />
            <Path d="M6 12h12" />
            <Path d="M9 18h6" />
          </Svg>
        </GlassCircleButton>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Карточка родителя. */}
        <GlassCard radius={22} onPress={goTo("d30")} contentStyle={{ padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ margin: 4.5 }}>
              <Avatar
                size={54}
                initials={parent.initials}
                gradient={parent.avatar_gradient}
                variant="ring"
                ringColor="#8b5cf6"
                fontSize={16}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14.5, color: tokens.ink1 }}>
                {parent.full_name}
              </Text>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.status.violet.text, marginTop: 2 }}>
                {d.parentApp.prof.parentRole}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2, marginTop: 2 }}>
                {parent.phone}
              </Text>
            </View>
            <ChevronRight tokens={tokens} scheme={scheme} />
          </View>
        </GlassCard>

        {/* 3–4. «Мои дети». */}
        <SectionHeader title={d.parentApp.prof.myKids} />
        <GlassCard contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {children.map((k, i) => (
            <ChildHubRow
              key={k.id}
              full_name={k.full_name}
              classLabel={`${k.class_name} ${d.parentApp.grades.class}`}
              initials={k.first_name.slice(0, 1)}
              gradient={k.avatar_gradient}
              ringColor={k.avatar_ring}
              status_chip={k.status_chip}
              tone={k.status_chip === "В школе" ? "green" : "gray"}
              divider={i > 0}
              onPress={() => navigation.navigate("d29")}
            />
          ))}
        </GlassCard>

        {/* 5–6. Настройки. */}
        <SectionHeader title={d.parentApp.prof.settings} />
        <GlassCard contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {settingsItems.map((it, i) => (
            <HubMenuRow key={it.key} item={it} divider={i > 0} onPress={goTo(it.route)} />
          ))}
        </GlassCard>

        {/* 7–8. Поддержка. */}
        <SectionHeader title={d.parentApp.scr.support} />
        <GlassCard contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {supportItems.map((it, i) => (
            <HubMenuRow key={it.key} item={it} divider={i > 0} onPress={goTo(it.route)} />
          ))}
        </GlassCard>

        {/* 9. Выйти. */}
        <Pressable
          onPress={() => setLogoutOpen(true)}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: `rgba(${tokens.status.red.rgb},0.55)`,
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tokens.status.red.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <Path d="m16 17 5-5-5-5" />
            <Path d="M21 12H9" />
          </Svg>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.red.text }}>
            {d.parentApp.prof.exit}
          </Text>
        </Pressable>

        {/* 10. Подпись версии. */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 9,
            color: tokens.ink3,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {fillTemplate(d.parentApp.prof.versionLabel, { v: version })}
        </Text>
      </ScrollView>

      {/* Подтверждение выхода (CONFIRM_DIALOGS.logout — B8). */}
      <CenterModalFrame
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        iconBg={`rgba(${tokens.status.red.rgb},0.12)`}
        iconBorder={`rgba(${tokens.status.red.rgb},0.35)`}
        icon={
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={tokens.status.red.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <Path d="m16 17 5-5-5-5" />
            <Path d="M21 12H9" />
          </Svg>
        }
        title={logoutDialog?.title ?? "Выйти?"}
        text={logoutDialog?.body}
      >
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 6 }}>
          <Pressable
            onPress={() => setLogoutOpen(false)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.06)",
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
              {d.parentApp.common.cancel}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={logoutDialog?.action_label ?? d.parentApp.prof.exit}
              onPress={() => {
                setLogoutOpen(false);
                // Заход 4: реальный logout сбрасывает AuthSessionContext →
                // RootNavigator переключается на AuthNavigator (Onboarding).
                signOut();
              }}
            />
          </View>
        </View>
      </CenterModalFrame>
    </AppBackground>
  );
}

/** Строка ребёнка «Мои дети». */
function ChildHubRow({
  full_name,
  classLabel,
  initials,
  gradient,
  ringColor,
  status_chip,
  tone,
  divider,
  onPress,
}: {
  full_name: string;
  classLabel: string;
  initials: string;
  gradient: [string, string];
  ringColor: string;
  status_chip: string;
  tone: "green" | "gray";
  divider: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const divColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: divColor,
      }}
    >
      <View style={{ margin: 4.5 }}>
        <Avatar size={36} initials={initials} gradient={gradient} ringColor={ringColor} variant="ring" fontSize={12} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
          {full_name}
        </Text>
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2, marginTop: 2 }}>
          {classLabel}
        </Text>
      </View>
      <StatusChip label={status_chip} family={tone} variant={tone === "green" ? "live" : "default"} />
      <ChevronRight tokens={tokens} scheme={scheme} />
    </Pressable>
  );
}

/** Строка пункта меню (Настройки/Поддержка). */
function HubMenuRow({
  item,
  divider,
  onPress,
}: {
  item: HubMenuItem;
  divider: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const divColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: divColor,
      }}
    >
      <LinearGradient
        colors={item.gradient}
        {...gradPoints(135)}
        style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {item.iconPaths.map((p, i) => <Path key={i} d={p} />)}
        </Svg>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
          {item.title}
        </Text>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2, marginTop: 2 }}>
          {item.subtitle}
        </Text>
      </View>
      <ChevronRight tokens={tokens} scheme={scheme} />
    </Pressable>
  );
}

function ChevronRight({ tokens, scheme }: { tokens: ThemeTokens; scheme: "light" | "dark" }) {
  const color = scheme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(26,19,74,0.4)";
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
