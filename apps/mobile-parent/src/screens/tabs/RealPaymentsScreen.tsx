/**
 * ВКЛАДКА «ОПЛАТЫ» У НАСТОЯЩЕГО РОДИТЕЛЯ. Заход 5 по оплатам, 30.08.2026.
 *
 * ЧТО ЭТО НЕ. Это не витрина. Витрина — соседний PaymentsScreen с балансом
 * 1 250 000, автоплатежом на Uzcard и кошельком столовой; её видит демо-гость,
 * и она не тронута ни строкой. Развилку держит demoOr шестым аргументом — тем
 * же приёмом, что у поддержки (d28): демо → витрина, настоящий вход → этот
 * экран. Витрина всегда в первой ветке, до второй исполнение не доходит.
 *
 * ЗЕРКАЛО ВЕБ-ЭКРАНА. Показывает ровно то же, что /parent/payments у
 * настоящего родителя (заход 2): баланс, долг, переплату, открытые счета,
 * кнопку оплаты со шторкой. Подписи — ИЗ ТОГО ЖЕ РАЗДЕЛА СЛОВАРЯ
 * (`parentApp.paymentsWeb`), чтобы два экрана не разошлись в словах об одних
 * деньгах. Данные — из общего слоя (заход 4), а не своими запросами.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ
 *  * строки автоплатежа — сохранять его некуда, тумблер обещал бы списание;
 *  * карточки кошелька — таблицы школьного кошелька в схеме нет ни одной;
 *  * способов оплаты — привязок карт не существует до подключения кассы.
 *    Все три — решения заказчика, те же, что приняты в вебе.
 *  * ДВУХ ИЗ ЧЕТЫРЁХ быстрых действий витрины. Её сетка ведёт на
 *    dtop/d20/d21/d33; в заходе 5 не было ни одной плитки — все четыре
 *    цели отвечали «Скоро», а плитка, ведущая в «Скоро», хуже её
 *    отсутствия. Заход 6 оживил историю (d20) и счета (d21) — вернулись
 *    ровно они. «Пополнить» и «Способы оплаты» по-прежнему «Скоро» и
 *    плиток не получили.
 *
 * СРОКА У СЧЁТА НЕТ. В `tuition_invoices` нет колонки с датой «до»: есть
 * месяц, сумма, статус и дата оплаты. Витринное «до 5 августа» — выдумка
 * макета, и повторять её на настоящих данных нельзя.
 *
 * В БАЗУ ИДЁТ realChildId. Экран берёт ребёнка из useChildScope — там он
 * приходит из настоящей привязки родителя (useParentData), выдуманных детей в
 * этой ветке не бывает вовсе. Плюс функции ядра сами роняют вызов, если
 * идентификатор не UUID.
 */
import { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import {
  LOCALE_TAG,
  getChildInvoices,
  getChildPaymentsSummary,
  pluralByForms,
  type ChildInvoice,
  type ChildPaymentsSummary,
} from "@snr/core";
import { LinearGradient } from "expo-linear-gradient";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  AccentInset,
  BottomSheetFrame,
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  ListRow,
  LoadingBlock,
  PrimaryButton,
  RootHeader,
  StatusChip,
  TabScreenScroll,
} from "../../ui";
import { useAppLocale } from "../../i18n";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useChildScope } from "../../hooks/useChildScope";
import { useParentData } from "../../context/ParentDataContext";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { getSupabase } from "../../lib/supabase";
import { ICONS } from "../../navigation/routes";
import { formatMoney } from "../../utils/format";
import { monthYear } from "../../lib/dateLabels";

/** Навигация вверх по дереву — та же структурная заглушка, что у витрины. */
interface AnyNav {
  navigate: (name: string, params?: object) => void;
}

/** Трубка. В ICONS макета телефона нет — держим путь здесь, а не правим
 *  общий набор витрины ради одной строки шторки. */
const PHONE_PATH =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z";
/** Булавка адреса. */
const PIN_PATH = "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z";

function Glyph({ paths, size = 20, color = "#fff", width = 1.9 }: {
  paths: readonly string[];
  size?: number;
  color?: string;
  width?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <Path key={i} d={p} />)}
    </Svg>
  );
}

/** Плитка быстрого действия — половина ширины (плиток две, не четыре). */
function QuickTile({
  label,
  paths,
  gradient,
  onPress,
}: {
  label: string;
  paths: readonly string[];
  gradient: [string, string];
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <GlassCard radius={16} contentStyle={{ alignItems: "center", gap: 5, paddingVertical: 12, paddingHorizontal: 6 }}>
        <LinearGradient
          colors={gradient}
          {...gradPoints(135)}
          style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" }}
        >
          <Glyph paths={paths} size={15} />
        </LinearGradient>
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink1, textAlign: "center" }}>
          {label}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

type Загруженное = { summary: ChildPaymentsSummary; invoices: ChildInvoice[]; failed: boolean };

export function RealPaymentsScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const localeTag = LOCALE_TAG[locale];
  const t = d.parentApp.paymentsWeb;
  const navigation = useNavigation() as unknown as AnyNav;

  const { childId, loading: childLoading } = useChildScope();
  const { data: parentData } = useParentData();
  const unread = useUnreadNotifications();

  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useAsyncData<Загруженное>(
    async () => {
      if (!childId) return { summary: { balance: 0, dueTotal: 0, dueCount: 0, overpayment: 0, failed: false }, invoices: [], failed: false };
      const db = getSupabase();
      // Сводка и список — одним заходом. Сводка внутри спрашивает счета сама,
      // но у неё своя ответственность (правило долга), и складывать её из
      // этого списка здесь значило бы завести вторую копию правила.
      const [summary, invoices] = await Promise.all([
        getChildPaymentsSummary(db, childId),
        getChildInvoices(db, childId),
      ]);
      return { summary, invoices: invoices.items, failed: summary.failed || invoices.failed };
    },
    [childId],
  );

  const открытые = useMemo(
    () => (state.data?.invoices ?? []).filter((i) => i.status === "open"),
    [state.data],
  );

  const summary = state.data?.summary;
  const школа = parentData
    ? { phone: parentData.schoolPhone, address: parentData.schoolAddress }
    : { phone: null, address: null };
  const телефонДляЗвонка = школа.phone ? школа.phone.replace(/[^\d+]/g, "") : null;

  const деньги = (n: number) => formatMoney(n, { withCurrency: true, currency: d.parentApp.pay.sum });

  const capsLabel = {
    fontFamily: fonts.manrope800,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.85)",
  };
  /** Мягкая подложка блоков шторки. Общего токена под неё в теме нет —
   *  экраны объявляют пару под свою схему сами (так же сделано в
   *  LoginChildPickerScreen и AuthHelpSheet). */
  const softBg = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.06)";
  const capsSection = {
    fontFamily: fonts.manrope800,
    fontSize: 9.5,
    letterSpacing: 0.08 * 9.5,
    textTransform: "uppercase" as const,
    color: tokens.ink3,
  };

  return (
    <AppBackground>
      <RootHeader
        title={d.parentApp.nav.payments}
        titleSize={17}
        showLogo={false}
        bellCount={unread}
        onBellPress={() => navigation.navigate("d8")}
        avatar={{
          initials: инициалы(parentData?.parentName ?? ""),
          gradient: ["#8b5cf6", "#6366f1"],
          variant: "ring",
        }}
        onAvatarPress={() => navigation.navigate("dhub")}
      />

      <TabScreenScroll style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingTop: 4 }}>
        {childLoading || state.loading ? <LoadingBlock /> : null}

        {!childLoading && !state.loading && state.error ? (
          <ErrorBlock
            title={t.loadFailedTitle}
            message={state.error.message}
            retryLabel={d.parentApp.common.retry}
            onRetry={() => void state.refresh()}
          />
        ) : null}

        {/* Сбой ОТДЕЛЬНОГО запроса (признак failed из слоя) — не то же, что
            упавший экран: данные не пришли, но экран цел. Показываем это
            прямо, а не нулями: «0 сум» вместо непрочитанного долга — ложь. */}
        {!state.loading && !state.error && state.data?.failed ? (
          <EmptyBlock title={t.loadFailedTitle} text={t.loadFailedText} />
        ) : null}

        {!state.loading && !state.error && summary && !state.data?.failed ? (
          <>
            <AccentCard
              gradient={["#ec4899", "#f97316", "#4f86f6"]}
              angle={135}
              shadowRgb="236,72,153"
              radius={22}
              contentStyle={{ padding: 16, gap: 12 }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={capsLabel}>{d.parentApp.pay.balanceTotalCap}</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 4 }}>
                    <Text style={{ fontFamily: fonts.unbounded600, fontSize: 26, color: "#fff" }}>
                      {formatMoney(summary.balance)}
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
                  <Glyph paths={ICONS.wallet} size={22} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <AccentInset radius={12} style={{ flex: 1, padding: 10, gap: 3 }}>
                  <Text style={capsLabel}>{d.parentApp.pay.balanceDueCap}</Text>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>
                    {деньги(summary.dueTotal)}
                  </Text>
                </AccentInset>
                <AccentInset radius={12} style={{ flex: 1, padding: 10, gap: 3 }}>
                  <Text style={capsLabel}>{d.parentApp.pay.balanceOverpaidCap}</Text>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#fff" }}>
                    {деньги(summary.overpayment)}
                  </Text>
                </AccentInset>
              </View>
            </AccentCard>

            {открытые.length > 0 ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <Text style={capsSection}>{d.parentApp.pay.dueNow}</Text>
                  <StatusChip
                    label={pluralByForms(открытые.length, locale, {
                      one: t.dueOne,
                      few: t.dueFew,
                      many: t.dueMany,
                    })}
                    family="orange"
                  />
                </View>

                <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                  {открытые.map((inv, i) => (
                    <ListRow
                      key={inv.id}
                      left={
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 13,
                            backgroundColor: "#7c3aed",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Glyph paths={ICONS.card} size={18} />
                        </View>
                      }
                      title={t.tuition}
                      subtitle={монтегод(inv.period_month, localeTag)}
                      right={
                        <View style={{ alignItems: "flex-end", gap: 3 }}>
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                            {formatMoney(inv.amount)}
                          </Text>
                          <StatusChip label={t.invoiceUnpaid} family="orange" />
                        </View>
                      }
                      divider={i > 0}
                      gap={11}
                      verticalPadding={10}
                    />
                  ))}
                </GlassCard>

                <PrimaryButton
                  label={t.payBtn.replace("{sum}", деньги(summary.dueTotal))}
                  icon={<Glyph paths={ICONS.card} size={16} />}
                  onPress={() => setSheetOpen(true)}
                />
              </>
            ) : (
              // Счетов нет вовсе — нормальное состояние, а не поломка: школа
              // могла ещё не выставить счёт за месяц. Кнопки оплаты тоже нет:
              // предлагать оплатить нечего.
              <EmptyBlock title={t.noInvoicesTitle} text={t.noInvoicesText} />
            )}

            {/* Две плитки, а не четыре: «Пополнить» и «Способы оплаты» у
                настоящего родителя пока отвечают «Скоро», и вести туда
                нечестно. Появятся вместе со своими экранами. */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <QuickTile
                label={d.parentApp.scr.payHistory}
                paths={ICONS.clock}
                gradient={["#60a5fa", "#2563eb"]}
                onPress={() => navigation.navigate("d20")}
              />
              <QuickTile
                label={t.invoicesTitle}
                paths={ICONS.doc}
                gradient={["#fbbf24", "#f97316"]}
                onPress={() => navigation.navigate("d21")}
              />
            </View>
          </>
        ) : null}
      </TabScreenScroll>

      {/* Шторка «онлайн-оплата не подключена» — та же, что в вебе. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
          <View style={{ alignItems: "center", gap: 9 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: `rgba(${tokens.status.violet.rgb},0.12)`,
                borderWidth: 1,
                borderColor: `rgba(${tokens.status.violet.rgb},0.35)`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Glyph paths={ICONS.card} size={23} color={tokens.status.violet.text} width={2} />
            </View>
            <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1, textAlign: "center" }}>
              {t.sheetTitle}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 11,
                lineHeight: 17,
                color: tokens.ink2,
                textAlign: "center",
              }}
            >
              {t.sheetText}
            </Text>
          </View>

          {открытые.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={capsSection}>{t.sheetInvoiceCap}</Text>
              <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: softBg }}>
                {открытые.map((inv) => (
                  <View key={inv.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink2 }}>
                      {t.tuition} · {монтегод(inv.period_month, localeTag)}
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                      {деньги(inv.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Как оплатить. Реквизитов (legal_details) нет намеренно — блок
              обязан выглядеть законченно на телефоне и адресе. */}
          <View style={{ gap: 6 }}>
            <Text style={capsSection}>{t.sheetHowCap}</Text>
            <View style={{ gap: 10, padding: 12, borderRadius: 16, backgroundColor: softBg }}>
              {школа.phone ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Glyph paths={[PHONE_PATH]} size={15} color={tokens.ink2} />
                  <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                    {t.sheetPhone}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                    {школа.phone}
                  </Text>
                </View>
              ) : null}
              {школа.address ? (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <Glyph paths={[PIN_PATH]} size={15} color={tokens.ink2} />
                  <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                    {t.sheetAddress}
                  </Text>
                  <Text
                    style={{
                      flexShrink: 1,
                      maxWidth: 200,
                      fontFamily: fonts.manrope700,
                      fontSize: 11,
                      color: tokens.ink1,
                      textAlign: "right",
                    }}
                  >
                    {школа.address}
                  </Text>
                </View>
              ) : null}
              {!школа.phone && !школа.address ? (
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 17, color: tokens.ink2 }}>
                  {t.sheetNoContacts}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
            <Pressable
              onPress={() => setSheetOpen(false)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: softBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                {t.sheetOk}
              </Text>
            </Pressable>
            {телефонДляЗвонка ? (
              <PrimaryButton
                label={t.sheetCall}
                onPress={() => {
                  setSheetOpen(false);
                  void Linking.openURL(`tel:${телефонДляЗвонка}`);
                }}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
        </View>
      </BottomSheetFrame>
    </AppBackground>
  );
}

/** ФИО → две буквы. Именно две: первое слово узбекского ФИО — фамилия. */
function инициалы(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** «Август 2026» из period_month «2026-08-01». Помощник общий с остальными
 *  экранами приложения — второго формата месяца не заводим. */
function монтегод(periodMonth: string, localeTag: string): string {
  return monthYear(periodMonth.slice(0, 7), localeTag);
}

export default RealPaymentsScreen;
