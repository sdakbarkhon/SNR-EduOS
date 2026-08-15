/**
 * Экран dsessions «Активные сессии» — НАСТОЯЩИЕ входы в аккаунт.
 *
 * ЧТО БЫЛО. Экран был собран из фикстуры: «iPhone 15 Pro · Ташкент · IP
 * 84.54.72.11», три выдуманных устройства и кнопки, которые вычёркивали
 * строки из локального списка. В заходе 5 кнопки перестали притворяться, но
 * данные так и остались примером.
 *
 * ГДЕ ВХОДЫ НА САМОМ ДЕЛЕ. Не в public.user_sessions — там реестр правила
 * «одна активная сессия», ровно одна строка на аккаунт (UNIQUE (user_id),
 * миграция 110), списка устройств из неё не получится. Настоящие входы лежат
 * в auth.sessions: строка на каждый вход, с датой входа, датой последнего
 * продления токена, User-Agent и адресом. Схема auth наружу не отдаётся,
 * поэтому читаем через RPC миграции 199 — она работает только от лица
 * вошедшего и чужих строк не отдаёт (проверено под настоящим ключом).
 *
 * ЧТО ДЕЛАЕТ КНОПКА «ЗАВЕРШИТЬ». Удаляет строку сессии, каскадом уходят её
 * refresh-токены — устройство больше не продлит вход. Уже выданный токен
 * доживает свой час, поэтому выход на том устройстве происходит не мгновенно;
 * экран об этом честно пишет. Текущий вход не закрывается: для него есть
 * «Выйти» в профиле.
 *
 * ЧЕГО В ДАННЫХ НЕТ. Названия устройства («iPhone 15 Pro») и города — Supabase
 * их не хранит. Есть только User-Agent (из него собираем «Chrome · Android
 * 14», «Приложение · iOS», «Служебный вход») и сетевой адрес. Выдумывать
 * недостающее не будем.
 *
 * Обе темы — useTheme(). iOS safe-area — из InnerHeader.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { deviceLabel, endSession, getMySessions, LOCALE_TAG, type OwnSession } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { CenterModalFrame, ErrorBlock, GlassCard, InnerHeader, LoadingBlock } from "../../ui";
import { NoticeBanner, SoonNote } from "../../ui/notices";
import { useAppLocale } from "../../i18n";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { getSupabase } from "../../lib/supabase";
import { addDays } from "../../lib/tashkent";
import { stamp } from "../../lib/dateLabels";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Крестик (кнопка «завершить» в строке), 24×24 viewBox, stroke 2.4. */
function CrossGlyph({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6 6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="m6 6 12 12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Log-out глиф — тот же контур, что и «Выйти» в ProfileHubScreen. */
function LogOutGlyph({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 17 5-5-5-5" />
      <Path d="M21 12H9" />
    </Svg>
  );
}

/** Белый stroke-глиф в 40×40 плитке. */
function DeviceGlyph({ paths, size = 19 }: { paths: string[]; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => (
        <Path key={i} d={p} />
      ))}
    </Svg>
  );
}

const PHONE_PATHS = [
  "M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z",
  "M12 18h.01",
];
const MONITOR_PATHS = [
  "M3 4h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
  "M8 20h8",
  "M12 16v4",
];
const TERMINAL_PATHS = ["m5 7 5 5-5 5", "M13 17h6"];

/** Глиф по тому, чем открыли: телефон, компьютер, служебный вход. */
function glyphFor(ua: string | null): string[] {
  if (!ua) return MONITOR_PATHS;
  if (/^node|Next\.js|Vercel/i.test(ua)) return TERMINAL_PATHS;
  if (/Expo\/|Android|iPhone|iPad|Mobile/i.test(ua)) return PHONE_PATHS;
  return MONITOR_PATHS;
}

export default function ActiveSessionsScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const s = t.sess;
  const navigation = useNavigation<Nav>();

  const state = useAsyncData<OwnSession[]>(() => getMySessions(getSupabase()), []);
  const sessions = state.data ?? [];
  const current = sessions.find((x) => x.isCurrent) ?? null;
  const others = sessions.filter((x) => !x.isCurrent);

  // Что показать после нажатия: подтверждение, ход дела и результат. Молчания
  // тут быть не должно — человек закрывает себе вход, он вправе знать исход.
  const [confirm, setConfirm] = useState<OwnSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "info" | "error"; text: string } | null>(null);

  const rowDivider = scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)";
  const capsInk = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const subInk = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.62)";

  const localeTag = LOCALE_TAG[locale];
  const todayKey = useTashkentToday();
  const when = (iso: string) =>
    stamp(iso, todayKey, addDays(todayKey, -1), localeTag, t.date.yesterday);

  const words = {
    unknown: t.more.sessionsUnknownDevice,
    app: s.deviceApp,
    script: s.deviceScript,
    web: s.deviceWeb,
  };

  const runEnd = useCallback(
    async (row: OwnSession) => {
      setConfirm(null);
      setBusy(true);
      setNote(null);
      try {
        const result = await endSession(getSupabase(), row.id);
        if (result === "ok") setNote({ kind: "ok", text: s.endedOne });
        else if (result === "current") setNote({ kind: "info", text: s.endCurrent });
        else setNote({ kind: "info", text: s.endedNone });
        await state.refresh();
      } catch (e) {
        console.error("[ActiveSessions] end_session:", (e as Error)?.message);
        setNote({ kind: "error", text: s.endError });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.refresh, s.endedOne, s.endCurrent, s.endedNone, s.endError],
  );

  /** «Завершить все другие» — по одному, чтобы частичный отказ не выглядел
   *  полным успехом: что закрылось, то закрылось, и список это покажет. */
  const endAll = useCallback(async () => {
    setBusy(true);
    setNote(null);
    let done = 0;
    try {
      for (const row of others) {
        const r = await endSession(getSupabase(), row.id);
        if (r === "ok") done += 1;
      }
      setNote(done > 0 ? { kind: "ok", text: s.endedOne } : { kind: "info", text: s.endedNone });
      await state.refresh();
    } catch (e) {
      console.error("[ActiveSessions] end_session (все):", (e as Error)?.message);
      setNote({ kind: "error", text: s.endError });
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [others, state.refresh, s.endedOne, s.endedNone, s.endError]);

  return (
    <AppBackground>
      <InnerHeader title={t.scr.sessions} titleSize={15} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={t.more4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => void state.refresh()}
          />
        ) : (
          <>
            {/* Текущее устройство — карточка на градиенте, как было в макете,
                но подписи собраны из настоящей строки сессии. */}
            {current ? (
              <>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 10.5,
                    letterSpacing: 10.5 * 0.08,
                    color: capsInk,
                  }}
                >
                  {s.currentCap}
                </Text>
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
                  <LinearGradient colors={["#34d399", "#0ea5e9"]} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
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
                    <DeviceGlyph paths={glyphFor(current.userAgent)} size={20} />
                  </View>

                  <View style={{ flex: 1, minWidth: 140, gap: 3 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#FFFFFF" }}>
                      {deviceLabel(current.userAgent, words)}
                    </Text>
                    {current.ip ? (
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>
                        {s.addr.replace("{ip}", current.ip)}
                      </Text>
                    ) : null}
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>
                      {s.entered.replace("{when}", when(current.createdAt))}
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)" }}>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: "#FFFFFF" }}>
                      {t.more.sessionsCurrent}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                letterSpacing: 10.5 * 0.08,
                color: capsInk,
                marginTop: 2,
              }}
            >
              {s.othersCap}
            </Text>

            <GlassCard radius={20} contentStyle={{ paddingVertical: others.length ? 5 : 0, paddingHorizontal: 14 }}>
              {others.length === 0 ? (
                <View style={{ paddingVertical: 22, paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, lineHeight: 17, color: tokens.ink3, textAlign: "center" }}>
                    {s.othersEmpty}
                  </Text>
                </View>
              ) : (
                others.map((row, i) => (
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
                      colors={["#94a3b8", "#64748b"]}
                      {...gradPoints(135)}
                      style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
                    >
                      <DeviceGlyph paths={glyphFor(row.userAgent)} />
                    </LinearGradient>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                        {deviceLabel(row.userAgent, words)}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subInk }}>
                        {s.entered.replace("{when}", when(row.createdAt))}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subInk }}>
                        {row.ip ? `${s.seen.replace("{when}", when(row.lastSeenAt))} · ${row.ip}` : s.seen.replace("{when}", when(row.lastSeenAt))}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setConfirm(row)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={s.end}
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
                        pressed || busy ? { opacity: 0.6 } : null,
                      ]}
                    >
                      <CrossGlyph color="#b91c1c" size={12} />
                    </Pressable>
                  </View>
                ))
              )}
            </GlassCard>

            {/* Итог операции — там же, где её запускали. */}
            {busy ? <SoonNote text={s.ending} /> : null}
            {!busy && note ? (
              note.kind === "ok" ? (
                <NoticeBanner
                  family="green"
                  paths={["M20 6 9 17l-5-5"]}
                  text={note.text}
                />
              ) : (
                <SoonNote text={note.text} />
              )
            ) : null}

            {others.length > 0 ? (
              <Pressable
                onPress={() => void endAll()}
                disabled={busy}
                accessibilityRole="button"
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
                  pressed || busy ? { opacity: 0.6 } : null,
                ]}
              >
                <LogOutGlyph color={tokens.status.red.text} />
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.red.text }}>
                  {s.endAll}
                </Text>
              </Pressable>
            ) : null}

            {/* Три подписи: что значит «продлён», как это уживается с правилом
                одной сессии на сайте и чего в данных нет вовсе. */}
            {[s.noteSeen, s.noteSingle, s.noteData].map((text, i) => (
              <Text
                key={i}
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9,
                  lineHeight: 14,
                  color: tokens.ink3,
                  textAlign: "center",
                  paddingHorizontal: 6,
                }}
              >
                {text}
              </Text>
            ))}
          </>
        )}
      </ScrollView>

      {/* Подтверждение: закрытие чужого входа — действие, которое не отменить. */}
      <CenterModalFrame
        visible={confirm !== null}
        onClose={() => setConfirm(null)}
        iconBg={`rgba(${tokens.status.red.rgb},0.12)`}
        iconBorder={`rgba(${tokens.status.red.rgb},0.35)`}
        icon={<LogOutGlyph color={tokens.status.red.text} />}
        title={s.confirmTitle}
        text={s.confirmText.replace("{device}", confirm ? deviceLabel(confirm.userAgent, words) : "")}
      >
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 6 }}>
          <Pressable
            onPress={() => setConfirm(null)}
            accessibilityRole="button"
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
          <Pressable
            onPress={() => confirm && void runEnd(confirm)}
            accessibilityRole="button"
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: `rgba(${tokens.status.red.rgb},0.55)`,
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.red.text }}>
              {s.end}
            </Text>
          </Pressable>
        </View>
      </CenterModalFrame>
    </AppBackground>
  );
}
