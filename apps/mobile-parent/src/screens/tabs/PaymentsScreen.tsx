/**
 * Экран П17 «Оплаты» — корневой таб (перенос 1:1 из макета,
 * строки 376–411, разведка recon-tabs §3).
 *
 * Композиция сверху вниз (recon):
 *  1. RootHeader без лого — заголовок «Оплаты», bell (badge 3) → d8, аватар «ДК» → dhub.
 *  2. AccentCard баланса — трёхстопный градиент ec4899→f97316→4f86f6; левая колонка
 *     (ОБЩИЙ БАЛАНС, число, «Доступно для расходов»), справа wallet-icon 42×42
 *     на glass-квадрате; внизу два AccentInset sub-tile: «К ОПЛАТЕ»/«ПЕРЕПЛАТА».
 *  3. SectionHeader «К оплате сейчас» + chip «2 счёта» (orange) + «Смотреть все ›» → d18.
 *  4. GlassCard с двумя ListRow счетов (BILLS.in_main_list) → d18.
 *  5. GlassCard-строка «Автоплатёж» с Toggle (локальный state; initial из PAYMENTS_OVERVIEW.autopay_enabled).
 *  6. PrimaryButton «Оплатить всё — {sum}» → d19.
 *  7. QuickActionsGrid 4 колонки: Пополнить (dtop) / История (d20) / Счета и чеки (d21) / Способы оплаты (d33).
 *  8. AccentCard «Кошелёк {gen}» → d22.
 *
 * Данные полностью из фикстур: getPaymentsOverview, getDueBills, getDueTotal,
 * getDueBillsCount, getSelectedChildContext (для gen-имени и баланса кошелька).
 * Никаких Ring/RingSegmented на этом экране не используется — только карточки,
 * ListRow, Toggle, PrimaryButton, QuickActionTile и AccentInset.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import {
  AccentCard,
  AccentInset,
  GlassCard,
  ListRow,
  PrimaryButton,
  QuickActionsGrid,
  QuickActionTile,
  RootHeader,
  Toggle,
} from "../../ui";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { useAppLocale } from "../../i18n";
import {
  getDueBills,
  getDueBillsCount,
  getDueTotal,
  getPaymentsOverview,
  getSelectedChildContext,
  getUnreadNotificationsCount,
} from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { ICONS } from "../../navigation/routes";
import { PARENT } from "../../data/fixtures/family";
import { formatMoney } from "../../utils/format";

/** Навигация: экран лежит внутри Tabs → BottomTabNavigator, а он вложен
 *  в Stack.Navigator; navigate работает вверх по дереву. Типизируем через
 *  структурную заглушку (жёсткая типизация CompositeNavigationProp тянет
 *  типы всех потомков и не даёт выигрыша при касте через `never`). */
interface AnyNav {
  navigate: (name: string, params?: object) => void;
  goBack: () => void;
  dispatch: (action: unknown) => void;
}

/** Иконка счётчика (белая) 20px. */
function WhiteGlyph({ paths, size = 20 }: { paths: string[]; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export default function PaymentsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation() as unknown as AnyNav;

  // Активный ребёнок — из DEFAULT_CHILD_INDEX (сессионный контекст введём в
  // Заходе 10; сейчас — фикстура). getSelectedChildContext резолвит Малику.
  const { child, wallet_balance } = getSelectedChildContext();
  const overview = getPaymentsOverview();
  const dueBills = getDueBills();
  const dueTotal = getDueTotal();
  const dueCount = getDueBillsCount();
  const unread = getUnreadNotificationsCount();

  const [autopay, setAutopay] = useState<boolean>(overview.autopay_enabled);

  // Уместные caps-стили для «ОБЩИЙ БАЛАНС» / «К ОПЛАТЕ» / «ПЕРЕПЛАТА».
  const capsLabelStyle = {
    fontFamily: fonts.manrope800,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.85)",
  };

  const orangeChip = tokens.chip(tokens.status.orange.rgb);

  // navigate работает по всей иерархии React Navigation — цели могут быть как
  // соседним табом (dhub), так и экраном родительского Stack (d8/d18/…).
  const goD = (k: keyof MainStackParamList | "p5" | "p10" | "p17" | "d24" | "dhub") =>
    () => navigation.navigate(k);

  return (
    <AppBackground>
      <RootHeader
        title={d.parentApp.nav.payments}
        titleSize={17}
        showLogo={false}
        bellCount={unread}
        onBellPress={goD("d8")}
        avatar={{
          initials: PARENT.initials,
          gradient: PARENT.avatar_gradient,
          variant: "ring",
        }}
        onAvatarPress={goD("dhub")}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Карточка баланса (три-стоп-градиент, макет 383–386). */}
        <AccentCard
          gradient={["#ec4899", "#f97316", "#4f86f6"]}
          angle={135}
          shadowRgb="236,72,153"
          radius={22}
          contentStyle={{ padding: 16, gap: 12 }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={capsLabelStyle}>{d.parentApp.pay.balanceTotalCap}</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 4 }}>
                <Text style={{ fontFamily: fonts.unbounded600, fontSize: 26, color: "#fff" }}>
                  {formatMoney(overview.total_balance)}
                </Text>
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  {d.parentApp.pay.sum}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                {d.parentApp.pay.balanceAvailable}
              </Text>
            </View>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                backgroundColor: "rgba(255,255,255,0.22)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WhiteGlyph paths={ICONS.wallet} size={22} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <AccentInset radius={12} style={{ flex: 1, padding: 10, gap: 3 }}>
              <Text style={capsLabelStyle}>{d.parentApp.pay.balanceDueCap}</Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>
                {formatMoney(dueTotal, { withCurrency: true, currency: d.parentApp.pay.sum })}
              </Text>
            </AccentInset>
            <AccentInset radius={12} style={{ flex: 1, padding: 10, gap: 3 }}>
              <Text style={capsLabelStyle}>{d.parentApp.pay.balanceOverpaidCap}</Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>
                {formatMoney(overview.overpayment, { withCurrency: true, currency: d.parentApp.pay.sum })}
              </Text>
            </AccentInset>
          </View>
        </AccentCard>

        {/* 3. Section «К оплате сейчас» + чип «N счёта» + «Смотреть все ›». */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                letterSpacing: 0.84,
                textTransform: "uppercase",
                color: scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)",
              }}
            >
              {d.parentApp.pay.dueNow}
            </Text>
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: orangeChip.bg,
                borderWidth: 1,
                borderColor: orangeChip.border,
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: tokens.status.orange.text }}>
                {fillTemplate(d.parentApp.pay.billsChip, { n: String(dueCount) })}
              </Text>
            </View>
          </View>
          <Pressable onPress={goD("d18")} hitSlop={8}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.status.violet.text }}>
              {d.parentApp.common.viewAll} ›
            </Text>
          </Pressable>
        </View>

        {/* 4. Счета «К оплате сейчас». */}
        <GlassCard contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {dueBills.map((bill, i) => (
            <ListRow
              key={bill.id}
              left={
                <BillIconTile gradient={bill.gradient} paths={bill.icon_paths} />
              }
              title={bill.title}
              subtitle={bill.note}
              right={
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                    {formatMoney(bill.amount)}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: tokens.status.orange.text }}>
                    {fillTemplate(d.parentApp.pay.billDueBy, { date: bill.due_date_label })}
                  </Text>
                </View>
              }
              chevron
              divider={i > 0}
              gap={11}
              verticalPadding={10}
              onPress={goD("d18")}
            />
          ))}
        </GlassCard>

        {/* 5. Автоплатёж (Toggle). */}
        <GlassCard contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          <ListRow
            left={
              <BillIconTile
                gradient={["#34d399", "#059669"]}
                paths={[
                  "M21 12a9 9 0 1 1-3-6.7",
                  "M21 4v5h-5",
                ]}
                size={36}
                radius={12}
              />
            }
            title={d.parentApp.pay.autopay}
            subtitle={overview.autopay_note}
            right={<Toggle value={autopay} onValueChange={setAutopay} />}
            gap={11}
            verticalPadding={10}
          />
        </GlassCard>

        {/* 6. Главная CTA. */}
        <PrimaryButton
          label={fillTemplate(d.parentApp.pay.payAllBtn, {
            sum: formatMoney(dueTotal, { withCurrency: true, currency: d.parentApp.pay.sum }),
          })}
          onPress={goD("d19")}
          icon={<WhiteGlyph paths={ICONS.card} size={16} />}
        />

        {/* 7. Быстрые действия — 4 колонки. */}
        <QuickActionsGrid columns={4} style={{ marginTop: 4 }}>
          <QuickActionTile
            size="sm"
            label={d.parentApp.pay.topupBtn}
            gradient={["#34d399", "#059669"]}
            shadowRgb="52,211,153"
            icon={<WhiteGlyph paths={ICONS.plus} size={15} />}
            onPress={goD("dtop")}
          />
          <QuickActionTile
            size="sm"
            label={d.parentApp.scr.payHistory}
            gradient={["#60a5fa", "#2563eb"]}
            shadowRgb="96,165,250"
            icon={<WhiteGlyph paths={ICONS.clock} size={15} />}
            onPress={goD("d20")}
          />
          <QuickActionTile
            size="sm"
            label={d.parentApp.pay.billsReceipts}
            gradient={["#fbbf24", "#f97316"]}
            shadowRgb="251,191,36"
            icon={<WhiteGlyph paths={ICONS.doc} size={15} />}
            onPress={goD("d21")}
          />
          <QuickActionTile
            size="sm"
            label={d.parentApp.scr.payMethods}
            gradient={["#a78bfa", "#7c3aed"]}
            shadowRgb="167,139,250"
            icon={<WhiteGlyph paths={ICONS.card} size={15} />}
            onPress={goD("d33")}
          />
        </QuickActionsGrid>

        {/* 8. Кошелёк ребёнка. */}
        <AccentCard
          gradient={["#7c3aed", "#a855f7"]}
          angle={135}
          shadowRgb="124,58,237"
          radius={20}
          contentStyle={{ padding: 14 }}
          onPress={goD("d22")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#7c3aed" }}>
                {child.first_name.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#fff" }}>
                {fillTemplate(d.parentApp.pay.walletTitle, { gen: child.first_name_gen })}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: "rgba(255,255,255,0.8)" }}>
                {d.parentApp.pay.walletSub}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>
              {formatMoney(wallet_balance, { withCurrency: true, currency: d.parentApp.pay.sum })}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="m9 18 6-6-6-6" stroke="rgba(255,255,255,0.85)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </AccentCard>
      </ScrollView>
    </AppBackground>
  );
}

/** Плитка-иконка счёта — 38×38 (or size) rounded-13, gradient 135°, белый SVG-глиф. */
function BillIconTile({
  gradient,
  paths,
  size = 38,
  radius = 13,
}: {
  gradient: [string, string];
  paths: string[];
  size?: number;
  radius?: number;
}) {
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size - 20} height={size - 20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, i) => <Path key={i} d={d} />)}
      </Svg>
    </LinearGradient>
  );
}
