/**
 * Экран dsessions «Активные сессии» — Заход (block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html» (block-list, сверху вниз):
 *  1. HeaderBar (InnerHeader): back-glass 38 + Unbounded 15/600 «Активные
 *     сессии» (t.scr.sessions) — БЕЗ правой кнопки (по макету у этого экрана
 *     правого слота нет).
 *  2. ScrollContainer: flex 1, gap 11, padding 4/18/118/18 (резерв под
 *     FloatingTabBar — экран стековый, но паддинг выровнен со всем стеком).
 *  3. CurrentDeviceHeroCard — ЛИТЕРАЛЬНАЯ (нет во фикстуре) карточка «это
 *     устройство»: непрозрачный градиент 135° #34d399→#0ea5e9, box-shadow
 *     0 16 36 rgba(14,165,233,.35) + inset-блик rgba(255,255,255,.35) сверху;
 *     иконка-плитка 42×42 (bg W20, border W40, phone-глиф W-stroke) + колонка
 *     (имя «iPhone 15 Pro» 12.5/800 white, «Ташкент · IP 84.54.72.11» и
 *     «Вход выполнен: 23 июля, 09:14» 9.5/600 W85) + pill «Это устройство»
 *     (bg W22, 9/800 white).
 *  4. SectionLabel «ДРУГИЕ УСТРОЙСТВА» (литерал, caps 10.5/800 tracking .08em).
 *  5. OtherDevicesCard — GlassCard r20; локальный state из getSessions() (3
 *     строки), каждая строка: icon-tile 40×40 (row.gradient + row.icon_paths
 *     как белый stroke-глиф) + имя (11.5/800) + подпись (9.5/600 dimmed) +
 *     круглая красная kill-кнопка 30×30 (bg rgba(239,68,68,.12), border
 *     rgba(239,68,68,.32), X-глиф #b91c1c) — удаляет только свою строку;
 *     hairline-разделители между строками (кроме первой); при опустении
 *     списка — центрированный тусклый текст «Других активных сессий нет».
 *  6. KillAllButton — полноширинный outline-button (border-red 1.5, red text,
 *     log-out глиф) «Завершить все другие сессии» — onPress очищает список
 *     локально (без confirm-диалога — вне скоупа этого захода).
 *  7. InfoBanner — оранжевая плашка (bg rgba(249,115,22,.1), border
 *     rgba(249,115,22,.3), r18); текст 10/600/1.55 с вложенным pressable-
 *     фрагментом «смените пароль» (800, #6d28d9 / #C4B5FD dark) → dchpass.
 *
 * Данные: getSessions() — ТОЛЬКО список «других устройств» (3 строки),
 * инициализируется в useState один раз (не пере-запрашивается на каждый
 * рендер). Hero-карточка «текущего устройства» — не из фикстуры, полностью
 * литеральна по правилу спец-контекста (аналог «Школа»/«Телефон» в
 * ChildProfileScreen.tsx). Экран учётный/безопасность — child-switcher не
 * нужен (в макете этого блока нет, инструкция явно это подтверждает).
 *
 * Обе темы — useTheme(). iOS safe-area — из InnerHeader.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, InnerHeader } from "../../ui";
import { getSessions } from "../../data";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Phone-глиф (тот же контур, что и в SESSIONS-фикстуре «ph2») — используется
 *  для иконки текущего устройства в hero-карточке (белый stroke, 42-плитка). */
const PHONE_PATHS = [
  "M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z",
  "M12 18h.01",
];

/** Крестик (kill-кнопка строки устройства), 24×24 viewBox, stroke 2.4. */
function CrossGlyph({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6 6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="m6 6 12 12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Log-out глиф (KillAllButton) — тот же контур, что и «Выйти» в ProfileHubScreen. */
function LogOutGlyph({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 17 5-5-5-5" />
      <Path d="M21 12H9" />
    </Svg>
  );
}

/** Белый stroke-глиф произвольного набора path (icon_paths из SessionRow),
 *  вписанный в 40×40 плитку с row.gradient (~19px глиф). */
function DeviceGlyph({ paths }: { paths: string[] }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => (
        <Path key={i} d={p} />
      ))}
    </Svg>
  );
}

export default function ActiveSessionsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();

  // Блок 5: локальный список «других устройств» — снимок фикстуры один раз.
  const [sessions, setSessions] = useState(() => getSessions());

  const rowDivider = scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)";
  const capsInk = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const subInk = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.62)";
  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.78)";
  const linkColor = scheme === "light" ? "#6D28D9" : "#C4B5FD";

  const killOne = (id: string) => setSessions((s) => s.filter((row) => row.id !== id));
  const killAll = () => setSessions([]);

  return (
    <AppBackground>
      {/* Блок 1: HeaderBar — без правой кнопки. */}
      <InnerHeader
        title={t.scr.sessions}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
      />

      {/* Блок 2: ScrollContainer. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* Блок 3: CurrentDeviceHeroCard — литеральная, вне фикстуры. */}
        <View
          style={[
            {
              position: "relative",
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              padding: 14,
              borderRadius: 20,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(14,165,233,0.35)" }),
          ]}
        >
          <LinearGradient
            colors={["#34d399", "#0ea5e9"]}
            {...gradPoints(135)}
            style={StyleSheet.absoluteFill}
          />
          {/* inset-блик 0 1.5 0 W35 — верхняя hairline-полоска. */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: "rgba(255,255,255,0.35)",
            }}
          />
          {/* Иконка-плитка 42×42 (bg W20, border W40). */}
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.2)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              {PHONE_PATHS.map((p, i) => (
                <Path key={i} d={p} />
              ))}
            </Svg>
          </View>

          <View style={{ flex: 1, minWidth: 140, gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#FFFFFF" }}>
              iPhone 15 Pro
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>
              Ташкент · IP 84.54.72.11
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>
              Вход выполнен: 23 июля, 09:14
            </Text>
          </View>

          {/* Pill «Это устройство» (bg W22, 9/800 white). */}
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 9,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.22)",
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: "#FFFFFF" }}>
              Это устройство
            </Text>
          </View>
        </View>

        {/* Блок 4: SectionLabel «ДРУГИЕ УСТРОЙСТВА». */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: capsInk,
          }}
        >
          ДРУГИЕ УСТРОЙСТВА
        </Text>

        {/* Блок 5: OtherDevicesCard — dynamic список + kill-кнопка на строку. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: sessions.length ? 5 : 0, paddingHorizontal: 14 }}>
          {sessions.length === 0 ? (
            <View style={{ paddingVertical: 22, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink3 }}>
                Других активных сессий нет
              </Text>
            </View>
          ) : (
            sessions.map((row, i) => (
              <View
                key={row.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: rowDivider,
                }}
              >
                <LinearGradient
                  colors={row.gradient}
                  {...gradPoints(135)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <DeviceGlyph paths={row.icon_paths} />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                    {row.name}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subInk }}>
                    {row.subtitle}
                  </Text>
                </View>
                <Pressable
                  onPress={() => killOne(row.id)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    {
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(239,68,68,0.12)",
                      borderWidth: 1,
                      borderColor: "rgba(239,68,68,0.32)",
                    },
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <CrossGlyph color="#b91c1c" size={12} />
                </Pressable>
              </View>
            ))
          )}
        </GlassCard>

        {/* Блок 6: KillAllButton — outline red, очищает список локально. */}
        <Pressable
          onPress={killAll}
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
            pressed ? { opacity: 0.75 } : null,
          ]}
        >
          <LogOutGlyph color={tokens.status.red.text} />
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.red.text }}>
            Завершить все другие сессии
          </Text>
        </Pressable>

        {/* Блок 7: InfoBanner — оранжевая плашка с pressable-фрагментом. */}
        <View
          style={{
            padding: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(249,115,22,0.1)",
            borderWidth: 1,
            borderColor: "rgba(249,115,22,0.3)",
          }}
        >
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 10 * 1.55, color: bannerText }}>
            Видите незнакомое устройство? Завершите его сессию и сразу{" "}
            <Text
              onPress={() => navigation.navigate("dchpass")}
              style={{ fontFamily: fonts.manrope800, fontWeight: "800", color: linkColor }}
            >
              смените пароль
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}
