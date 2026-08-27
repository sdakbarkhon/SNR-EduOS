/**
 * ChildWallet (d22) — Заход 6, REBUILD.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1035–1064:
 *  1036–1040 Header — InnerHeader-подобная шапка: круглая back-кнопка 38,
 *   заголовок Unbounded 15/600 «Кошелёк ребёнка» (t.scrChildWallet),
 *   правая круглая glass-кнопка 38 с иконкой «3 горизонтальные точки»
 *   (goWalletMenu). Собрано на InnerHeader + GlassCircleButton, как это
 *   сделано в TopicMasteryScreen и др. учебных экранах.
 *  1042–1045 Balance Card — фиолетовый градиент 135° #7c3aed→#a855f7,
 *   radius 22, padding 15. Верхний ряд: белый avatar-круг 38 с инициалом
 *   активного ребёнка, walletTitle (13/800 #fff), CTA «+ Пополнить»
 *   (goTopup). Нижний ряд: столбик «БАЛАНС» (9/800 caps) + число
 *   (Unbounded 25/600) и outline-wallet-icon 40×40.
 *  1046–1051 Quick Actions Grid — 4 колонки, каждая ячейка — круглая
 *   иконка 46×46 с градиентом и подпись 9/700. goTopup/goHistory.
 *   27.08.2026: «Перевести» и «Лимиты» убраны — см. комментарий у действий.
 *  1052 Section Header «Последние операции» + link «Смотреть все ›»
 *   (goWalletOps). Никаких фильтров/чипов/поиска — их в макете нет.
 *  1053–1058 Operations List — glass-карточка r20, padding 5/14; 4 строки
 *   ДОСЛОВНО из макета (icon-tile 36×36 + title 12/800 + subtitle-время
 *   9.5/600 + сумма 12.5/800). Расход #b91c1c, приход #047857 — цвета
 *   макета, не токены (это фиолетовый вариант карточки, не тема).
 *  1059–1062 Info Callout — оранжевый bulb, bg rgba(249,115,22,.1),
 *   border rgba(249,115,22,.3), stroke #c2410c.
 *
 * Данные: активный ребёнок = useAuthSession().currentChildId (fallback
 * DEFAULT_CHILD_INDEX) → getSelectedChildContext → ФИО/инициал/gen/баланс
 * (для Малики = 185 000 из WALLETS[1] — единый источник). ОПЕРАЦИИ на
 * этом экране — курируемая витрина Захода 6: BLOCK-LIST задаёт 4 строки
 * ДОСЛОВНО (в т.ч. текст «Пополнение кошелька», отличающийся от
 * walletops-экрана «Пополнение с карты»), поэтому вынесены как локальный
 * const RECENT_OPS, а не берутся из WALLET_OPS (там разбивка по дням и
 * другие подписи). Значения полей — со страницы 1054–1057.
 *
 * Ни FAB, ни empty-state, ни поиска, ни секций «Кружки» — их в макете
 * этого экрана нет (правило заказчика §правила).
 *
 * 15.08.2026 (оплаты). Кнопка-«меню» в шапке убрана — за ней стояла заглушка
 * без действий. Локальная витрина RECENT_OPS удалена: операции берутся из
 * общего data/demoPayments.ts, подпись дня — «Сегодня/Вчера/дата» на языке
 * интерфейса от школьного «сегодня». Сверху — плашка «это пример».
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, GlassCircleButton } from "../../ui";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { useAppLocale } from "../../i18n";
import { DemoBanner } from "./parts";
import { LOCALE_TAG } from "@snr/core";
import { WALLET_OPS } from "../../data/demoPayments";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { addDays } from "../../lib/tashkent";
import { dayMonth } from "../../lib/dateLabels";
import {
  getChildren,
  getSelectedChildContext,
  defaultChildId,
} from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import type { MainStackParamList } from "../../navigation/routes";
import { formatMoney } from "../../utils/format";

/** Экран лежит в общем Stack; navigate работает вверх по дереву. */
interface AnyNav {
  navigate: (name: string, params?: object) => void;
  goBack: () => void;
}

/* ============================================================================
 * «Последние операции». Раньше здесь лежала ВТОРАЯ копия операций кошелька
 * — четыре строки прямо в файле, с датами русским текстом («21 июля, 09:12»).
 * Теперь берём те же операции, что и экран «Все операции», из единственного
 * места выдуманных оплат (data/demoPayments.ts), а подпись дня собираем на
 * языке интерфейса от школьного «сегодня».
 * ============================================================================ */
type OpKind = "expense" | "income";
interface RecentOp {
  id: string;
  title: string;
  timeTxt: string;
  amount: number;
  kind: OpKind;
  gradient: [string, string];
  iconPaths: string[];
  strokeWidth: number;
}

/* Цвета сумм — из макета (строки 1054–1057), НЕ токены темы:
 * balance-карточка всегда фиолетовая (единый вид в обеих темах),
 * список операций читается на glass-подложке одинаково. */
const AMOUNT_EXPENSE = "#b91c1c";
const AMOUNT_INCOME = "#047857";

/* ============================================================================
 * Ассеты
 * ============================================================================ */

/** SVG-глиф в белом цвете (для plus-CTA / плиток quick-actions / wallet-outline). */
function WhiteGlyph({
  paths,
  size = 18,
  strokeWidth = 2,
  color = "#fff",
}: {
  paths: string[];
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
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

/** Outline-wallet 40×40 (макет 1044). */
function WalletOutline({ size = 40 }: { size?: number }) {
  return (
    <WhiteGlyph
      paths={[
        "M20 12V8H6a2 2 0 0 1 0-4h12v4",
        "M4 6v12a2 2 0 0 0 2 2h14v-6",
        "M18 12a2 2 0 0 0 0 4h4v-4Z",
      ]}
      size={size}
      strokeWidth={1.6}
      color="rgba(255,255,255,0.55)"
    />
  );
}

/** Иконка лампочки для info-callout (макет 1060). */
function BulbIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5A5.5 5.5 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </Svg>
  );
}

/* ============================================================================
 * Плитка Quick-Action (46×46 круг + подпись). Макет 1047–1050.
 * ============================================================================ */
interface QuickCircleProps {
  label: string;
  gradient: [string, string];
  shadowRgb: string;
  iconPaths: string[];
  strokeWidth?: number;
  onPress?: () => void;
  labelColor: string;
}
function QuickCircle({
  label,
  gradient,
  shadowRgb,
  iconPaths,
  strokeWidth = 2,
  onPress,
  labelColor,
}: QuickCircleProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: "center", gap: 5 }}
    >
      <LinearGradient
        colors={gradient}
        {...gradPoints(135)}
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: `rgb(${shadowRgb})`,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 18,
          elevation: 6,
        }}
      >
        <WhiteGlyph paths={iconPaths} size={18} strokeWidth={strokeWidth} />
      </LinearGradient>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.manrope700, fontSize: 9, color: labelColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ============================================================================
 * Строка операции — 36×36 плитка + текст + сумма (макет 1054–1057).
 * ============================================================================ */
function OperationRow({
  op,
  divider,
  dividerColor,
  titleColor,
  subtitleColor,
}: {
  op: RecentOp;
  divider: boolean;
  dividerColor: string;
  titleColor: string;
  subtitleColor: string;
}) {
  const isIncome = op.kind === "income";
  const sign = isIncome ? "+" : "−";
  const amountColor = isIncome ? AMOUNT_INCOME : AMOUNT_EXPENSE;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderTopColor: dividerColor,
      }}
    >
      <LinearGradient
        colors={op.gradient}
        {...gradPoints(135)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: op.gradient[1],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <WhiteGlyph paths={op.iconPaths} size={15} strokeWidth={op.strokeWidth} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope800, fontSize: 12, color: titleColor }}
        >
          {op.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subtitleColor, marginTop: 1 }}
        >
          {op.timeTxt}
        </Text>
      </View>
      <Text
        style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: amountColor }}
      >
        {sign}
        {formatMoney(op.amount)}
      </Text>
    </View>
  );
}

/* ============================================================================
 * ЭКРАН
 * ============================================================================ */

export default function ChildWalletScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const navigation = useNavigation() as unknown as AnyNav;
  const insets = useSafeAreaInsets();
  const { currentChildId } = useAuthSession();

  // Активный ребёнок → инициал / walletTitle / walletBalTxt (BLOCK-LIST 2).
  const children = getChildren();
  const initialChildId = currentChildId ?? defaultChildId();
  const { child, wallet_balance } = getSelectedChildContext(initialChildId);

  const childInitial = child.first_name.slice(0, 1);
  // walletTitle макета — «Кошелёк {gen}» (см. d.parentApp.pay.walletTitle).
  const walletTitle = d.parentApp.pay.walletTitle.replace(
    "{gen}",
    child.first_name_gen,
  );
  const walletBalTxt = formatMoney(wallet_balance);

  // Первые четыре операции из общего списка. Подпись дня — «Сегодня» /
  // «Вчера» / дата на языке интерфейса, а не готовая русская строка.
  const localeTag = LOCALE_TAG[locale];
  const todayKey = useTashkentToday();
  const recentOps: RecentOp[] = WALLET_OPS.flatMap((day) =>
    day.ops.map((op) => {
      const dayKey = addDays(todayKey, -day.daysAgo);
      const dayTxt =
        day.daysAgo === 0
          ? d.parentApp.date.today
          : day.daysAgo === 1
            ? d.parentApp.date.yesterday
            : dayMonth(dayKey, localeTag);
      return {
        id: op.id,
        title: `${op.title} · ${op.via}`,
        timeTxt: `${dayTxt}, ${op.time}`,
        amount: op.amount,
        kind: op.direction === "in" ? ("income" as const) : ("expense" as const),
        gradient: op.gradient,
        iconPaths: op.paths,
        strokeWidth: 1.9,
      };
    }),
  ).slice(0, 4);

  const go = (k: keyof MainStackParamList) => () => navigation.navigate(k);
  // walletmenu — единственная цель, у которой нет собственного экрана в
  // STACK_ROUTES (см. routes.ts): открываем универсальную заглушку
  // StubScreen через маршрут 'stub' + params.stubKey, как это делают
  // ScheduleScreen / TeacherProfileScreen / MealsScreen.
  // Кнопка-«меню» в шапке удалена: за ней стояла заглушка «Действия с
  // кошельком», а все доступные действия и так лежат плитками на экране —
  // пополнить, перевести, лимиты, все операции.

  const goTopup = go("dtop");
  const goHistory = go("d20");
  const goWalletOps = go("dwops");
  const goBack = () => navigation.goBack();

  /* --- Header (BLOCK-LIST 1) --- */
  // Реализуем как ручную композицию, ибо InnerHeader из UI-кита
  // прекрасно закрывает эту разметку (используется тем же образом
  // в TopicMasteryScreen — right-слот с GlassCircleButton).
  const header = (
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
      <GlassCircleButton onPress={goBack}>
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={tokens.ink1}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M19 12H5" />
          <Path d="m12 19-7-7 7-7" />
        </Svg>
      </GlassCircleButton>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonts.unbounded600,
          fontSize: 15,
          color: tokens.ink1,
          textAlign: "center",
        }}
      >
        {d.parentApp.scr.childWallet}
      </Text>
      {/* Правый слот пуст: кнопка-«меню» вела на заглушку без действий.
          Держим ширину back-кнопки, чтобы заголовок остался по центру. */}
      <View style={{ width: 38 }} />
    </View>
  );

  /* --- Секц.-заголовок и линки — цвета зависят от темы --- */
  const sectionCapColor =
    scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)";
  const linkViolet = "#6d28d9"; // ссылка «Смотреть все ›» — фиолетовая в макете
  const opsTitleColor = tokens.ink1;
  const opsSubtitleColor =
    scheme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(26,19,74,0.6)";
  const opsDividerColor =
    scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(23,18,67,0.07)";
  const calloutSubColor =
    scheme === "dark" ? "rgba(255,255,255,0.75)" : "rgba(26,19,74,0.7)";

  return (
    <AppBackground>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
          gap: 12,
        }}
      >
        <DemoBanner text={d.parentApp.pay2.demoBanner} />

        {/* BLOCK 2 — Balance Card (фиолетовый градиент). */}
        <View
          style={{
            borderRadius: 22,
            overflow: "hidden",
            shadowColor: "#7c3aed",
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.38,
            shadowRadius: 36,
            elevation: 12,
          }}
        >
          <LinearGradient
            colors={["#7c3aed", "#a855f7"]}
            {...gradPoints(135)}
            style={{ padding: 15, gap: 10 }}
          >
            {/* Верхний ряд: initial-avatar + walletTitle + CTA «+ Пополнить». */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#fff",
                  shadowOpacity: 0.4,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 12.5,
                    color: "#7c3aed",
                  }}
                >
                  {childInitial}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: fonts.manrope800,
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                {walletTitle}
              </Text>
              <Pressable
                onPress={goTopup}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 11,
                  borderRadius: 11,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.4)",
                  overflow: "hidden",
                }}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "#fff" }}>
                  + {d.parentApp.pay.topupBtn}
                </Text>
              </Pressable>
            </View>

            {/* Нижний ряд: БАЛАНС / число + outline-wallet. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 9,
                    letterSpacing: 0.07 * 9,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  {d.parentApp.pay.balance.toUpperCase()}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.unbounded600,
                    fontSize: 25,
                    color: "#fff",
                  }}
                >
                  {walletBalTxt}
                </Text>
              </View>
              <WalletOutline size={40} />
            </View>
          </LinearGradient>
        </View>

        {/* BLOCK 3 — Quick Actions Grid.
            27.08.2026: было четыре действия, стало два. «Перевести» снят
            заказчиком: по утверждённой модели оплаты деньги между балансами
            детей не ходят вовсе. «Лимиты» противоречат модели — баланс минус
            счёт за обучение, ограничивать нечего. Оба экрана удалены целиком,
            а не спрятаны: спрятанный мёртвый код через полгода принимают за
            рабочий. */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <QuickCircle
            label={d.parentApp.pay.topupBtn}
            gradient={["#34d399", "#059669"]}
            shadowRgb="5,150,105"
            iconPaths={["M12 5v14", "M5 12h14"]}
            strokeWidth={2.2}
            onPress={goTopup}
            labelColor={tokens.ink1}
          />
          <QuickCircle
            label={d.parentApp.scr.payHistory.split(" ")[0]}
            gradient={["#fbbf24", "#f97316"]}
            shadowRgb="249,115,22"
            iconPaths={["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"]}
            onPress={goHistory}
            labelColor={tokens.ink1}
          />
        </View>

        {/* BLOCK 4 — Section header. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10.5,
              letterSpacing: 0.08 * 10.5,
              textTransform: "uppercase",
              color: sectionCapColor,
            }}
          >
            {d.parentApp.pay.lastOps}
          </Text>
          <Pressable onPress={goWalletOps} hitSlop={8}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: linkViolet }}>
              {d.parentApp.common.viewAll} ›
            </Text>
          </Pressable>
        </View>

        {/* BLOCK 5 — Operations List Card (4 строки с разделителями). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {recentOps.map((op, i) => (
            <OperationRow
              key={op.id}
              op={op}
              divider={i > 0}
              dividerColor={opsDividerColor}
              titleColor={opsTitleColor}
              subtitleColor={opsSubtitleColor}
            />
          ))}
        </GlassCard>

        {/* BLOCK 6 — Info Callout (оранжевый bulb). */}
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
          <BulbIcon />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: calloutSubColor,
            }}
          >
            Кошелёк можно использовать в столовой и школьном магазине. Наличные ребёнку не нужны — все траты видны вам в реальном времени.
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

