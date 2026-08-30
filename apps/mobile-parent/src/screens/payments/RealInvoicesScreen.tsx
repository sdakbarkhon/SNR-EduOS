/**
 * «СЧЕТА» У НАСТОЯЩЕГО РОДИТЕЛЯ (d21). Заход 6 по оплатам, 30.08.2026.
 *
 * ЧТО ЭТО НЕ. Это не витрина. Витрина — соседний ReceiptsScreen с двумя
 * табами «Чеки»/«Invoices» и шестью выдуманными документами; её видит
 * демо-гость, и она не тронута ни строкой. Развилку держит demoOr шестым
 * аргументом, как у вкладки оплат и у поддержки.
 *
 * РЕШЕНИЯ ПОВТОРЕНЫ ЗА ВЕБ-ВЕРСИЕЙ (заход 3), а не приняты заново — два
 * экрана об одних счетах обязаны выглядеть и вести себя одинаково:
 *  * ЧЕКОВ НЕТ И ПЕРЕКЛЮЧАТЕЛЯ ТОЖЕ. Чек выдаёт платёжная система, которой у
 *    школы нет. Пустая вкладка обещала бы, что там что-то появится, а
 *    переключатель из двух пилюль, где вторая никуда не ведёт, — это не
 *    навигация. Экран начинается прямо со списка, заголовок «Счета».
 *  * КНОПОК СКАЧИВАНИЯ НЕТ: файлов не существует, а круглая стрелка вниз —
 *    это обещание файла.
 *  * СИНЕЙ ПЛАШКИ про «хранятся в электронном виде, можно скачать в PDF» нет:
 *    ни скачать, ни отправить нельзя.
 *  * ГРУППЫ ПО СТАТУСУ, а не по сроку: срока у счёта в базе нет вовсе.
 *  * У ОПЛАЧЕННОГО в чипе стоит дата оплаты — именно она отличает его от
 *    открытого.
 *  * ОТМЕНЁННЫЕ НЕ ПРЯЧЕМ: счёт отменил человек в школе, и родителю честнее
 *    видеть, что он был и снят. Приглушены, чтобы не путались с долгом.
 *
 * ЧЕМ МОБИЛЬНОЕ ВЫНУЖДЕННО ОТЛИЧАЕТСЯ ОТ ВЕБА
 *  * Шапку рисует сам экран (InnerHeader), а не «страница» — страниц в RN
 *    нет вовсе. В вебе заголовок пришлось уносить в компонент отдельным
 *    решением, здесь это обычный порядок вещей.
 *  * Прокрутка — ScrollView с ручным нижним отступом 118 под плавающий
 *    таб-бар; в вебе таб-бар не перекрывает поток.
 *  * Пустое состояние и сбой рисуются общими EmptyBlock/ErrorBlock кита, а
 *    не веб-овским EmptyState: это те же тексты в компонентах платформы.
 *
 * В БАЗУ ИДЁТ realChildId — ребёнок из useChildScope, где демо-ветки нет
 * вовсе; плюс функции ядра роняют вызов на не-UUID.
 */
import { ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { getChildInvoices, LOCALE_TAG, type ChildInvoice } from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  InnerHeader,
  LoadingBlock,
  StatusChip,
  type StatusFamily,
} from "../../ui";
import { useAppLocale } from "../../i18n";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useChildScope } from "../../hooks/useChildScope";
import { getSupabase } from "../../lib/supabase";
import { ICONS } from "../../navigation/routes";
import { formatMoney } from "../../utils/format";
import { fullDate, monthYear } from "../../lib/dateLabels";

type Загруженное = { invoices: ChildInvoice[]; failed: boolean };

function Glyph({ paths, size = 18, color = "#fff" }: { paths: readonly string[]; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <Path key={i} d={p} />)}
    </Svg>
  );
}

export function RealInvoicesScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const localeTag = LOCALE_TAG[locale];
  const t = d.parentApp.paymentsWeb;

  const { childId, loading: childLoading } = useChildScope();

  const state = useAsyncData<Загруженное>(
    async () => {
      if (!childId) return { invoices: [], failed: false };
      const r = await getChildInvoices(getSupabase(), childId);
      return { invoices: r.items, failed: r.failed };
    },
    [childId],
  );

  const все = state.data?.invoices ?? [];
  const открытые = все.filter((i) => i.status === "open");
  const оплаченные = все.filter((i) => i.status === "paid");
  const отменённые = все.filter((i) => i.status === "canceled");
  const долг = открытые.reduce((s, i) => s + i.amount, 0);

  const capsSection = {
    fontFamily: fonts.manrope800,
    fontSize: 10.5,
    letterSpacing: 0.08 * 10.5,
    textTransform: "uppercase" as const,
    color: tokens.ink3,
  };

  /** Подпись под названием: изменённую школой сумму родитель обязан видеть. */
  const пометкаПравки = (inv: ChildInvoice): string | null => {
    if (inv.amount_source !== "admin_adjusted") return null;
    return inv.adjust_reason
      ? t.invoiceAdjusted.replace("{reason}", inv.adjust_reason)
      : t.invoiceAdjustedNoReason;
  };

  const Строка = ({
    inv,
    label,
    family,
    dimmed,
  }: {
    inv: ChildInvoice;
    label: string;
    family: StatusFamily;
    dimmed: boolean;
  }) => (
    <GlassCard variant="glass2" radius={16} contentStyle={{ padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, opacity: dimmed ? 0.6 : 1 }}>
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
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
              {t.tuition}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>
              {monthYear(inv.period_month.slice(0, 7), localeTag)}
            </Text>
          </View>
          {пометкаПравки(inv) ? (
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, lineHeight: 14, color: tokens.ink2 }}>
              {пометкаПравки(inv)}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
              {formatMoney(inv.amount)}
            </Text>
            <StatusChip label={label} family={family} />
          </View>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <AppBackground>
      <InnerHeader title={t.invoicesTitle} titleSize={15} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 11, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118 }}
      >
        {childLoading || state.loading ? <LoadingBlock /> : null}

        {!childLoading && !state.loading && state.error ? (
          <ErrorBlock
            title={t.loadFailedTitle}
            message={state.error.message}
            retryLabel={d.parentApp.common.retry}
            onRetry={() => void state.refresh()}
          />
        ) : null}

        {/* Сбой ОТДЕЛЬНОГО запроса — не пустой список. Пустой вместо ошибки
            был бы правдоподобной ложью «счетов нет». */}
        {!state.loading && !state.error && state.data?.failed ? (
          <EmptyBlock title={t.loadFailedTitle} text={t.loadFailedText} />
        ) : null}

        {!state.loading && !state.error && !state.data?.failed && все.length === 0 ? (
          <EmptyBlock title={t.noInvoicesTitle} text={t.noInvoicesText} />
        ) : null}

        {открытые.length > 0 ? (
          <View style={{ gap: 11 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
              <Text style={capsSection}>{t.invoicesOpenCap}</Text>
              {/* Итог группы — сумма ровно тех строк, что под ним:
                  пересчитывается глазами и совпадает с «К оплате» на вкладке. */}
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: tokens.ink2 }}>
                {formatMoney(долг, { withCurrency: true, currency: d.parentApp.pay.sum })}
              </Text>
            </View>
            {открытые.map((inv) => (
              <Строка key={inv.id} inv={inv} label={t.invoiceUnpaid} family="orange" dimmed={false} />
            ))}
          </View>
        ) : null}

        {оплаченные.length > 0 ? (
          <View style={{ gap: 11 }}>
            <Text style={capsSection}>{t.invoicesPaidCap}</Text>
            {оплаченные.map((inv) => (
              <Строка
                key={inv.id}
                inv={inv}
                label={
                  inv.paid_at
                    ? t.invoicePaidOn.replace("{date}", fullDate(inv.paid_at, localeTag))
                    : t.invoicePaid
                }
                family="green"
                dimmed={false}
              />
            ))}
          </View>
        ) : null}

        {отменённые.length > 0 ? (
          <View style={{ gap: 11 }}>
            <Text style={capsSection}>{t.invoicesCanceledCap}</Text>
            {отменённые.map((inv) => (
              <Строка key={inv.id} inv={inv} label={t.invoiceCanceled} family="gray" dimmed />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

export default RealInvoicesScreen;
