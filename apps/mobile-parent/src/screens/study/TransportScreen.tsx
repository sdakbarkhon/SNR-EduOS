/**
 * dtrans «Транспорт» — REBUILD (заход 5x-batch, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 1699–1732:
 *  1. HeaderBar (1700–1704): back-glass 38 (goBack) + Unbounded 15/600
 *     t.svc.transport (flex:1) + kebab-glass 38 (goProfMenu → stub «profmenu»).
 *  2. ScrollContainer (1705): flex 1, gap 11, padding 4/18/118/18.
 *  3. RouteBanner (1706–1710): непрозрачный градиент 135° #fbbf24→#f97316,
 *     r22, padding 15, gap 6, тень 0 16 36 rgba(249,115,22,.35) + inset
 *     hairline W35:
 *       3a. row «Маршрут № 3» (Unbounded 16/600 #fff, литерал) + live-pill
 *           «В пути» (white/22% bg, border white/40%, зелёная точка 5px
 *           #4ade80 с glow 0 0 6 #4ade80).
 *       3b. subtitle «Юнусабад — SNR International School» (11/700 white/90%,
 *           литерал).
 *       3c. arrival-строка «Прибытие на вашу остановку — {time}» (10.5/800
 *           #fff) — {time} ВЫЧИСЛЯЕТСЯ как stops.find(is_my_stop)?.time_label,
 *           не хардкодится (правило data-слоя «не хардкодится, считается»).
 *  4. SectionLabel «ОСТАНОВКИ» (1711).
 *  5. StopsCard (1712–1716): glass r20 padding 12/14 — TimelineVertical,
 *     фид из getTransportRoute(locale).stops (state=status, label=name, time=
 *     time_label, chipLabel=is_my_stop?«Ваша остановка»:undefined).
 *  6. SectionLabel «ВОДИТЕЛЬ И АВТОБУС» (1717).
 *  7. DriverCard (1718–1721): glass r20 padding 5/14 — весь блок литерал
 *     (в фикстурах данных о водителе нет):
 *       7a. row1 (1719): аватар 40 circle градиент #fbbf24→#f97316 + белое
 *           кольцо (box-shadow 0 0 0 2px #fff), инициалы «РА»; ФИО «Рустам
 *           Ахмедов» 12/800 + роль «Водитель» 9.5/600 dimmed; круглая
 *           зелёная call-кнопка 34×34 (bg rgba(16,185,129,.14), border
 *           rgba(16,185,129,.35), phone-glyph 14 stroke #047857) →
 *           navigate("stub",{stubKey:"call"}).
 *       7b. row2 (1720): «Госномер» / «01 A 123 BC», hairline divider сверху.
 *       7c. row3 (1721): «Марка автобуса» / «Yutong ZK6115», hairline divider.
 *  8. SectionLabel «УВЕДОМЛЕНИЯ» (1723).
 *  9. NotificationsCard (1724–1726): glass r20 padding 5/14, 2×
 *     NotificationRow (паттерн 1:1 из LimitsScreen.tsx):
 *       9a. «Уведомить за 10 минут до прибытия» (без divider) — arrival.
 *       9b. «Уведомить о посадке и высадке» (divider сверху) — delays.
 *     Локальный state инициализирован из getTransportRoute(locale).notify_defaults.
 * 10. InfoBanner (1728–1731): padding 12/14 r18, bg rgba(249,115,22,.1),
 *     border rgba(249,115,22,.3); bell-alert glyph 17 stroke #c2410c; текст
 *     10/600 LH 1.55 rgba(26,19,74,.7) с вложенным pressable-спаном
 *     «объявлениях школы» (800, #6d28d9 / dark #C4B5FD) → navigate("d26").
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ДЕВИАЦИЯ (см. также structured-report deviations):
 * Батч-инструкция «CHILD CONTEXT» требует ChildSwitcherCard compact-row под
 * шапкой на каждом из 8 экранов. Верифицировано ПРЯМЫМ чтением исходного
 * mockup-файла (строки 1699–1732, дважды, включая omitted-строки через Read):
 * на экране «Транспорт» такого блока НЕТ — сразу после ScrollContainer идёт
 * RouteBanner. Данные маршрута (getTransportRoute(locale)) тоже не зависят от
 * childId — маршрут общий для всех детей на этом автобусе. Следуя правилу
 * метода №2 («implement EVERY block from your list… do not add anything not
 * in the mockup block»), ChildSwitcherCard/BottomSheetFrame НЕ добавлены —
 * это сознательное расхождение с batch-boilerplate, а не пропуск.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Данные — getTransportRoute(locale) (TRANSPORT_STOPS + TRANSPORT_NOTIFY_DEFAULTS).
 * Тексты — d.parentApp.svc.transport (заголовок); литералы баннера/водителя —
 * дословно из макета (нет соответствующих fixture-полей). Обе темы —
 * useTheme(). iOS safe-area — из InnerHeader.
 *
 * 15.08.2026 (заглушки). Сверху — плашка «данных нет, это пример»: маршрутов
 * и автобусов в базе школы нет, карта и время подставлены из фикстуры.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  TimelineVertical,
  Toggle,
} from "../../ui";
import { getTransportRoute } from "../../data";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { DemoBanner } from "../../ui/notices";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Kebab (3 точки по горизонтали) 16 stroke 2.2 — правый слот шапки
 *  (макет строка 1703; 1:1 KebabIcon из ChildProfileScreen.tsx). */
function KebabIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={5} cy={12} r={1} />
      <Circle cx={12} cy={12} r={1} />
      <Circle cx={19} cy={12} r={1} />
    </Svg>
  );
}

/** Phone-glyph 14 (call-кнопка водителя, макет строка 1719). */
function PhoneGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" />
    </Svg>
  );
}

/** Bell-alert glyph 17 (info-banner, макет строка 1729). */
function AlertBellGlyph() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5A5.5 5.5 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </Svg>
  );
}

/** Строка label:value внутри DriverCard (макет 1720–1721), 1:1 стиль InfoRow
 *  (ChildProfileScreen.tsx): label — tokens.ink2, value — tokens.ink1. */
function InfoRow({
  label,
  value,
  labelInk,
  valueInk,
  divider,
}: {
  label: string;
  value: string;
  labelInk: string;
  valueInk: string;
  divider: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: divider,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: labelInk }}>{label}</Text>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: valueInk }}>{value}</Text>
    </View>
  );
}

/** Строка уведомления: подпись 11.5/800 flex + Toggle (1:1 из LimitsScreen.tsx). */
function NotificationRow({
  label,
  value,
  onToggle,
  first = false,
  ink,
  divider,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  first?: boolean;
  ink: string;
  divider: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: divider,
      }}
    >
      <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 11.5, color: ink }}>{label}</Text>
      <Toggle value={value} onValueChange={onToggle} />
    </View>
  );
}

export default function TransportScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();

  const route = getTransportRoute(locale);
  const { stops, notify_defaults } = route;

  const [notifyArrival, setNotifyArrival] = useState<boolean>(notify_defaults.arrival);
  const [notifyDelays, setNotifyDelays] = useState<boolean>(notify_defaults.delays);

  // Время прибытия на «мою» остановку — ВЫЧИСЛЯЕТСЯ, не хардкодится.
  const myStopTime = useMemo(
    () => stops.find((s) => s.is_my_stop)?.time_label ?? "",
    [stops],
  );

  const rowDivider = scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)";
  const capsInk = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.78)";
  const announceLink = scheme === "light" ? "#6D28D9" : "#C4B5FD";
  const driverRoleInk = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.66)";

  const goProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });
  const goCall = () => navigation.navigate("stub", { stubKey: "call" });
  const goAnnounce = () => navigation.navigate("d26");

  return (
    <AppBackground>
      {/* Блок 1 — HeaderBar (1700–1704). */}
      <InnerHeader
        title={t.svc.transport}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={goProfMenu}>
            <KebabIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      {/* Блок 2 — ScrollContainer (1705): padding 4/18/118/18 (макет: 4px 18px 118px). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* Плашка «это пример» — раздела ещё нет в базе школы. */}
        <DemoBanner text={d.parentApp.soon.sections.transport} />

        {/* Блок 3 — RouteBanner (1706–1710). */}
        <View
          style={[
            { borderRadius: 22, overflow: "hidden" },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(249,115,22,0.35)" }),
          ]}
        >
          <LinearGradient colors={["#FBBF24", "#F97316"]} {...gradPoints(135)} style={{ padding: 15, gap: 6 }}>
            {/* inset-блик 0 1.5 0 W35. */}
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
            {/* 3a — заголовок + live-pill «В пути». */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: fonts.unbounded600, fontSize: 16, color: "#FFFFFF" }}>
                Маршрут № 3
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.4)",
                }}
              >
                <View
                  style={[
                    { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#4ADE80" },
                    shadowStyle({ x: 0, y: 0, blur: 6, color: "#4ADE80" }),
                  ]}
                />
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: "#FFFFFF" }}>В пути</Text>
              </View>
            </View>
            {/* 3b — подзаголовок маршрута. */}
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
              Юнусабад — SNR International School
            </Text>
            {/* 3c — время прибытия (вычислено). */}
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: "#FFFFFF" }}>
              {`Прибытие на вашу остановку — ${myStopTime}`}
            </Text>
          </LinearGradient>
        </View>

        {/* Блок 4 — SectionLabel «ОСТАНОВКИ» (1711). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: capsInk,
          }}
        >
          Остановки
        </Text>

        {/* Блок 5 — StopsCard (1712–1716). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <TimelineVertical
            stops={stops.map((s) => ({
              label: s.name,
              time: s.time_label,
              state: s.status,
              chipLabel: s.is_my_stop ? "Ваша остановка" : undefined,
            }))}
          />
        </GlassCard>

        {/* Блок 6 — SectionLabel «ВОДИТЕЛЬ И АВТОБУС» (1717). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: capsInk,
          }}
        >
          Водитель и автобус
        </Text>

        {/* Блок 7 — DriverCard (1718–1721). Литерал: нет fixture-поля для водителя. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {/* 7a — аватар + ФИО/роль + call-кнопка. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 }}>
            {/* Аватар 40 circle, градиент 135° + белое кольцо 2px (box-shadow 0 0 0 2px #fff). */}
            <LinearGradient
              colors={["#FBBF24", "#F97316"]}
              {...gradPoints(135)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#FFFFFF",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>РА</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                Рустам Ахмедов
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: driverRoleInk }}>
                Водитель
              </Text>
            </View>
            {/* Call-кнопка 34×34 (макет строка 1719): bg rgba(16,185,129,.14),
                border rgba(16,185,129,.35) — не GlassCircleButton (тот не
                параметризуется цветом), локальная Pressable 1:1. */}
            <Pressable
              onPress={goCall}
              style={({ pressed }) => [
                {
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(16,185,129,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(16,185,129,0.35)",
                },
                pressed ? { opacity: 0.85 } : null,
              ]}
            >
              <PhoneGlyph />
            </Pressable>
          </View>
          {/* 7b — Госномер. */}
          <InfoRow
            label="Госномер"
            value="01 A 123 BC"
            labelInk={tokens.ink2}
            valueInk={tokens.ink1}
            divider={rowDivider}
          />
          {/* 7c — Марка автобуса. */}
          <InfoRow
            label="Марка автобуса"
            value="Yutong ZK6115"
            labelInk={tokens.ink2}
            valueInk={tokens.ink1}
            divider={rowDivider}
          />
        </GlassCard>

        {/* Блок 8 — SectionLabel «УВЕДОМЛЕНИЯ» (1723). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: capsInk,
          }}
        >
          Уведомления
        </Text>

        {/* Блок 9 — NotificationsCard (1724–1726). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          <NotificationRow
            label="Уведомить за 10 минут до прибытия"
            value={notifyArrival}
            onToggle={() => setNotifyArrival((v) => !v)}
            first
            ink={tokens.ink1}
            divider={rowDivider}
          />
          <NotificationRow
            label="Уведомить о посадке и высадке"
            value={notifyDelays}
            onToggle={() => setNotifyDelays((v) => !v)}
            ink={tokens.ink1}
            divider={rowDivider}
          />
        </GlassCard>

        {/* Блок 10 — InfoBanner (1728–1731). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(249,115,22,0.1)",
            borderWidth: 1,
            borderColor: "rgba(249,115,22,0.3)",
          }}
        >
          <AlertBellGlyph />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: bannerText,
            }}
          >
            Маршрут может меняться в дни мероприятий — изменения приходят заранее в{" "}
            <Text onPress={goAnnounce} style={{ fontFamily: fonts.manrope800, color: announceLink }}>
              объявлениях школы
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}
