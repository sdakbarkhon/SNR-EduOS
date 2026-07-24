/**
 * dmeals «Питание» — Заход 5, пересборка block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 1465–1509.
 *
 * Порядок блоков (сверху вниз, дословно из block-list):
 *  1.  HeaderBar               (строки 1466–1470): back-glass 38 + Unbounded 15/600
 *                              «Питание» + подпись «Сегодня, 23 июля» (dsLblMeals) +
 *                              круглый glass-календарь goDatepick.
 *  2.  ScrollContainer         (строка 1471): flex 1, gap 12, padding 4/18/118/18.
 *  3.  WalletBalanceCard       (строки 1472–1477): AccentCard mint→sky, caps
 *                              «БАЛАНС ПИТАНИЯ», pill-кнопка «Пополнить» справа,
 *                              крупная сумма walletBalTxt, подпись «Оплачено до
 *                              31 июля». Декоративная SVG-иконка приборов
 *                              absolute bottom-right с opacity .5.
 *  4.  SectionHeader           «МЕНЮ НА СЕГОДНЯ» (строка 1478).
 *  5.  TodayComplexCard        (строки 1479–1488): GlassCard r20, верхняя строка
 *                              — квадрат 44 mint/sky + «Комплекс "Стандарт"» +
 *                              «Среда, 23 июля»; блок из 4 пунктов «· …» через
 *                              hairline W07; статус-строка «Обед получен в 12:40»
 *                              с чекмарком в зелёном круге 18.
 *  6.  SectionHeader           «МЕНЮ НА НЕДЕЛЮ» (строка 1489).
 *  7.  WeekPillsRow            (строки 1490–1492): горизонтальный ScrollView,
 *                              6 столбцов по 2 строки (день недели / число);
 *                              активный день — mint→sky градиент с shadow.
 *  8.  DishesListCard          (строки 1493–1497): GlassCard r20, строки блюд —
 *                              точка (mint→sky) · название · подпись kind, hairline W07.
 *  9.  SectionHeader           «ПОСЛЕДНИЕ ПОКУПКИ» (строка 1498).
 *  10. RecentPurchasesCard     (строки 1499–1503): GlassCard r20, три транзакции —
 *                              квадратная иконка 34 с градиентом, заголовок + дата,
 *                              сумма красным (−18 000 / −9 000 / −5 000).
 *  11. InfoBanner              (строки 1504–1507): оранжевая полупрозрачная плашка
 *                              с иконкой лампочки и правилами школьного питания.
 *
 * Данные — из фикстур: getWalletBalance(childId) и getMealsWeek() (MEALS_WEEK
 * + MEALS_DAY_PILLS + DEFAULT_MEAL_DAY_INDEX). Тексты хрома — d.parentApp.*.
 * Обе темы — useTheme(). iOS safe-area через InnerHeader.
 *
 * NB: комплекс «Стандарт», статус получения обеда и список последних покупок
 * в макете (стр. 1479–1503) — hardcoded HTML без sc-for; сюда перенесены как
 * локальные константы 1:1 из макета. В data-слое соответствующих аксессоров
 * пока нет (см. block-list п.5/п.10 — «стоит вынести в data при переносе»).
 * НЕТ «опозданий», НЕТ «кружков» (правила заказчика).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { AccentCard, GlassCard, GlassCircleButton, InnerHeader, SectionHeader } from "../../ui";
import { DEMO_TODAY, getMealsWeek, getWalletBalance } from "../../data";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import { formatMoney } from "../../lib/format";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

// ─── SVG-пути (дословно из макета) ───────────────────────────────────────────

/** Приборы «вилка + ложка» (декоративная и в квадратной иконке комплекса,
 *  а также в иконке транзакции «Столовая», строки 1473, 1481, 1500). */
const CUTLERY_PATHS = [
  "M4 2v7a3 3 0 0 0 6 0V2",
  "M7 12v10",
  "M20 2a4 4 0 0 0-4 4v7h4",
  "M20 13v9",
];
/** Иконка календаря (goDatepick, строка 1469). */
const CAL_PATHS = [
  "M8 2v4",
  "M16 2v4",
  "M3 4a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
  "M3 10h18",
];
/** Чекмарк «Обед получен» (строка 1487). */
const CHECK_PATHS = ["M20 6 9 17l-5-5"];
/** Иконка «кружка» — Буфет (иконка транзакций 2 и 3, строки 1501, 1502). */
const MUG_PATHS = [
  "M17 8h1a4 4 0 0 1 0 8h-1",
  "M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z",
];
/** Лампочка (info-banner, строка 1505). */
const BULB_PATHS = [
  "M15 14c.2-1 .7-1.7 1.5-2.5A5.5 5.5 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5",
  "M9 18h6",
  "M10 22h4",
];

// ─── Хард-код из макета (см. NB в шапке файла) ───────────────────────────────

/** Верхняя карточка «Меню на сегодня» — Комплекс «Стандарт» (стр. 1481–1487). */
const TODAY_COMPLEX = {
  complexName: 'Комплекс «Стандарт»',
  dateLabel: DEMO_TODAY.label_full,
  items: [
    "Суп лагман",
    "Плов с говядиной",
    "Салат из свежих овощей",
    "Компот из сухофруктов",
  ],
  statusText: "Обед получен в 12:40",
} as const;

/** Три транзакции «Последние покупки» (стр. 1500–1502) — суммы отрицательные,
 *  чтобы formatMoney напечатал их с «-» + NBSP-разрядами. */
type PurchaseIconKind = "canteen" | "buffet-warm" | "buffet-cold";
const RECENT_PURCHASES: {
  title: string;
  dateTime: string;
  amount: number;
  iconKind: PurchaseIconKind;
}[] = [
  { title: "Столовая · обед", dateTime: "Сегодня, 12:40", amount: -18000, iconKind: "canteen" },
  { title: "Буфет · сок и булочка", dateTime: "21 июля, 10:20", amount: -9000, iconKind: "buffet-warm" },
  { title: "Буфет · вода", dateTime: "18 июля, 11:05", amount: -5000, iconKind: "buffet-cold" },
];

const PURCHASE_ICONS: Record<
  PurchaseIconKind,
  { gradient: [string, string]; shadowRgb: string; paths: string[] }
> = {
  canteen: { gradient: ["#34d399", "#0ea5e9"], shadowRgb: "14,165,233", paths: CUTLERY_PATHS },
  "buffet-warm": { gradient: ["#fbbf24", "#f97316"], shadowRgb: "249,115,22", paths: MUG_PATHS },
  "buffet-cold": { gradient: ["#22d3ee", "#0891b2"], shadowRgb: "8,145,178", paths: MUG_PATHS },
};

// ─── Мини-компоненты (только для этого экрана) ───────────────────────────────

/** Path-набор поверх Svg (белый контур, единый stroke). */
function StrokedGlyph({
  paths,
  size,
  stroke,
  strokeWidth = 1.8,
}: {
  paths: readonly string[];
  size: number;
  stroke: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/** Квадратная градиентная иконка транзакции 34×34 r11 (строки 1500–1502). */
function PurchaseIcon({ kind }: { kind: PurchaseIconKind }) {
  const spec = PURCHASE_ICONS[kind];
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 11,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        ...shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${spec.shadowRgb},0.28)` }),
      }}
    >
      <LinearGradient colors={spec.gradient} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      <StrokedGlyph paths={spec.paths} size={14} stroke="#FFFFFF" strokeWidth={1.9} />
    </View>
  );
}

/** Пилл дня недели (mealPills[i], строки 1490–1492). Ширина ≥46, высота
 *  auto через padding 8/0. Активный — плотный градиент mint→sky. */
function DayPill({
  weekday,
  day,
  active,
  onPress,
  inactiveInkMuted,
  inactiveInk,
  scheme,
}: {
  weekday: string;
  day: number;
  active: boolean;
  onPress: () => void;
  inactiveInkMuted: string;
  inactiveInk: string;
  scheme: "light" | "dark";
}) {
  const g = gradPoints(135);
  const glassBg =
    scheme === "light"
      ? ["rgba(255,255,255,0.7)", "rgba(255,255,255,0.46)"]
      : ["rgba(56,52,120,0.58)", "rgba(56,52,120,0.36)"];
  const glassBorder = scheme === "light" ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.16)";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          minWidth: 46,
          borderRadius: 15,
          overflow: "hidden",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 6,
        },
        active
          ? shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(14,165,233,0.35)" })
          : { borderWidth: 1, borderColor: glassBorder },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {active ? (
        <LinearGradient
          colors={["#34d399", "#0ea5e9"]}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={glassBg as [string, string]}
          {...gradPoints(160)}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 9,
          color: active ? "rgba(255,255,255,0.85)" : inactiveInkMuted,
        }}
      >
        {weekday}
      </Text>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: active ? "#FFFFFF" : inactiveInk,
          marginTop: 2,
        }}
      >
        {day}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Экран.
// ─────────────────────────────────────────────────────────────────────────────

export default function MealsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const auth = useAuthSession();

  // Активный ребёнок — из auth-сессии либо дефолт фикстур.
  const childId = auth.currentChildId ?? undefined;
  const walletBalance = getWalletBalance(childId);

  // Меню недели: 6 пиллов + 4-элементный список блюд выбранного дня.
  const { week, day_pills, default_day_index } = getMealsWeek();
  const [mealDay, setMealDay] = useState<number>(default_day_index);
  const dishes = week[mealDay] ?? [];

  // Тексты — из словаря + фиксированный подпись даты «Сегодня, 23 июля»
  // (dsLblMeals в макете, initial state 3482 → dsLblMv).
  const title = d.parentApp.svc.meals;
  const subtitle = DEMO_TODAY.label_today;
  const walletBalTxt = `${formatMoney(walletBalance)} ${d.parentApp.pay.sum}`;

  // Полупрозрачные пары под обе темы (макет использует rgba(23,18,67,.07) на
  // светлой; на тёмной подмешиваем светлый hairline). Такая же семья, как в
  // DayStatusScreen / EduosAssistantScreen.
  const rowDivider = scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)";
  const itemInk = scheme === "light" ? "rgba(26,19,74,0.74)" : "rgba(255,255,255,0.78)";
  const kindInk = scheme === "light" ? "rgba(26,19,74,0.55)" : "rgba(255,255,255,0.58)";
  const dateSubInk = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.6)";
  const pillMutedInk = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const pillInk = scheme === "light" ? "#171243" : "#FFFFFF";
  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.75)";

  const g135 = gradPoints(135);
  const complexIconGrad = ["rgba(52,211,153,0.28)", "rgba(14,165,233,0.28)"] as [string, string];

  return (
    <AppBackground>
      {/* Блок 1 — HeaderBar (строки 1466–1470). */}
      <InnerHeader
        title={title}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton
            onPress={() => navigation.navigate("stub", { stubKey: "datepick" })}
          >
            <StrokedGlyph paths={CAL_PATHS} size={16} stroke={tokens.ink1} />
          </GlassCircleButton>
        }
      />
      {/* Подпись под заголовком (dsLblMeals). InnerHeader не тянет subtitle,
          поэтому рендерим её отдельной строкой с тем же горизонтальным
          отступом (18px) и цветом ink2/.6. */}
      <View style={{ paddingHorizontal: 18 + 38 + 12, paddingBottom: 4, marginTop: -6 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: dateSubInk }}
        >
          {subtitle}
        </Text>
      </View>

      {/* Блок 2 — ScrollContainer (строка 1471). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* Блок 3 — WalletBalanceCard (строки 1472–1477). */}
        <AccentCard
          gradient={["#34d399", "#0ea5e9"]}
          angle={135}
          shadowRgb="14,165,233"
          radius={22}
          contentStyle={{ padding: 15, gap: 6 }}
        >
          {/* Декоративная приборы-иконка absolute bottom-right, opacity .5. */}
          <View
            pointerEvents="none"
            style={{ position: "absolute", bottom: 10, right: 12, opacity: 0.5 }}
          >
            <StrokedGlyph paths={CUTLERY_PATHS} size={48} stroke="#FFFFFF" strokeWidth={1.4} />
          </View>
          {/* Верхняя строка: caps «БАЛАНС ПИТАНИЯ» + pill «Пополнить» (goTopup). */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 8.5,
                letterSpacing: 8.5 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              БАЛАНС ПИТАНИЯ
            </Text>
            <Text
              onPress={() => navigation.navigate("dtop")}
              suppressHighlighting
              style={{
                paddingVertical: 6,
                paddingHorizontal: 11,
                borderRadius: 11,
                fontFamily: fonts.manrope800,
                fontSize: 10,
                color: "#FFFFFF",
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.22)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              {d.parentApp.pay.topupBtn}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.unbounded600,
              fontSize: 24,
              color: "#FFFFFF",
            }}
          >
            {walletBalTxt}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 10.5,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Оплачено до 31 июля
          </Text>
        </AccentCard>

        {/* Блок 4 — «МЕНЮ НА СЕГОДНЯ» (строка 1478). */}
        <SectionHeader title="МЕНЮ НА СЕГОДНЯ" />

        {/* Блок 5 — TodayComplexCard (строки 1479–1488). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 13, paddingHorizontal: 14, gap: 9 }}>
          {/* Верхняя строка — иконка 44 + название + дата. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: scheme === "light" ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.18)",
              }}
            >
              <LinearGradient
                colors={complexIconGrad}
                start={g135.start}
                end={g135.end}
                style={StyleSheet.absoluteFill}
              />
              <StrokedGlyph paths={CUTLERY_PATHS} size={20} stroke="#047857" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
              >
                {TODAY_COMPLEX.complexName}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: dateSubInk }}
              >
                {TODAY_COMPLEX.dateLabel}
              </Text>
            </View>
          </View>

          {/* Список из 4 пунктов «· …», hairline сверху. */}
          <View
            style={{
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: rowDivider,
              gap: 5,
            }}
          >
            {TODAY_COMPLEX.items.map((item) => (
              <Text
                key={item}
                style={{ fontFamily: fonts.manrope700, fontSize: 11, color: itemInk }}
              >{`· ${item}`}</Text>
            ))}
          </View>

          {/* Статус-строка «Обед получен в 12:40», hairline сверху. */}
          <View
            style={{
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: rowDivider,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(16,185,129,0.16)",
              }}
            >
              <StrokedGlyph paths={CHECK_PATHS} size={10} stroke="#047857" strokeWidth={3} />
            </View>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                color: "#047857",
              }}
            >
              {TODAY_COMPLEX.statusText}
            </Text>
          </View>
        </GlassCard>

        {/* Блок 6 — «МЕНЮ НА НЕДЕЛЮ» (строка 1489). */}
        <SectionHeader title="МЕНЮ НА НЕДЕЛЮ" />

        {/* Блок 7 — WeekPillsRow (строки 1490–1492). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingBottom: 2 }}
        >
          {day_pills.map(([wLabel, dayNum], i) => (
            <DayPill
              key={i}
              weekday={wLabel}
              day={dayNum}
              active={i === mealDay}
              onPress={() => setMealDay(i)}
              inactiveInkMuted={pillMutedInk}
              inactiveInk={pillInk}
              scheme={scheme}
            />
          ))}
        </ScrollView>

        {/* Блок 8 — DishesListCard (строки 1493–1497). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {dishes.map(([name, kind], i) => (
            <View
              key={`${mealDay}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                paddingVertical: 9,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: rowDivider,
              }}
            >
              {/* Точка блюда 7×7 — mint→sky (единый цвет в макете, строка 4357). */}
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={["#34d399", "#0ea5e9"]}
                  start={g135.start}
                  end={g135.end}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: fonts.manrope700,
                  fontSize: 11.5,
                  color: tokens.ink1,
                }}
              >
                {name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: kindInk,
                }}
              >
                {kind}
              </Text>
            </View>
          ))}
        </GlassCard>

        {/* Блок 9 — «ПОСЛЕДНИЕ ПОКУПКИ» (строка 1498). */}
        <SectionHeader title="ПОСЛЕДНИЕ ПОКУПКИ" />

        {/* Блок 10 — RecentPurchasesCard (строки 1499–1503). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {RECENT_PURCHASES.map((p, i) => (
            <View
              key={p.title}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: rowDivider,
              }}
            >
              <PurchaseIcon kind={p.iconKind} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 11.5,
                    color: tokens.ink1,
                  }}
                >
                  {p.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: dateSubInk,
                  }}
                >
                  {p.dateTime}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12,
                  color: "#B91C1C",
                }}
              >
                {`−${formatMoney(Math.abs(p.amount))}`}
              </Text>
            </View>
          ))}
        </GlassCard>

        {/* Блок 11 — InfoBanner (строки 1504–1507). */}
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
          <StrokedGlyph paths={BULB_PATHS} size={17} stroke="#C2410C" strokeWidth={1.9} />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: bannerText,
            }}
          >
            Школьное питание действует в столовой и буфете SNR International School.
            Оплата — только с кошелька ребёнка, наличные не принимаются.
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}
