/**
 * «ИСТОРИЯ ОПЛАТ» У НАСТОЯЩЕГО РОДИТЕЛЯ (d20). Заход 6 по оплатам, 30.08.2026.
 *
 * ЧТО ЭТО НЕ. Не витрина. Витрина — соседний PaymentHistoryScreen с четырьмя
 * фильтрами и шестью выдуманными платежами через Payme и Click; её видит
 * демо-гость, и она не тронута ни строкой. Развилку держит demoOr шестым
 * аргументом.
 *
 * ИСТОЧНИК — ЖУРНАЛ ДВИЖЕНИЙ ПО БАЛАНСУ (`balance_entries`, миграция 227).
 * Журнал только пополняется: править и удалять записи запрещает триггер, даже
 * служебному ключу. Строка здесь — не «платёж», а движение; знак каждого вида
 * задан проверкой в самой базе:
 *   topup           пополнение            всегда «+»
 *   invoice_charge  погашение счёта       всегда «−»
 *   refund          возврат               всегда «−»
 *   adjustment      корректировка школы   знак любой
 *
 * РЕШЕНИЯ ПОВТОРЕНЫ ЗА ВЕБ-ВЕРСИЕЙ (заход 3):
 *  * ЧЕТЫРЁХ ФИЛЬТРОВ НЕТ. «Все / Обучение / Питание / Другое» — категории
 *    выдуманных платежей макета; в `balance_entries` категории нет вовсе.
 *  * СВОДКА ВНИЗУ ПОКАЗЫВАЕТСЯ НЕ ВСЕГДА. Она считается по строкам этого же
 *    экрана: пришло ровно `limit` — журнал может быть длиннее, и итог
 *    перестал бы быть итогом. Признак `complete` даёт сам слой (заход 4).
 *    Три колонки не пересекаются: пополнено − списано − возвраты = баланс.
 *
 * ЧЕМ МОБИЛЬНОЕ ВЫНУЖДЕННО ОТЛИЧАЕТСЯ ОТ ВЕБА
 *  * Шапку рисует сам экран (InnerHeader) — страниц в RN нет.
 *  * Прокрутка — ScrollView с нижним отступом 118 под плавающий таб-бар.
 *  * Значка «возврат» в наборе ICONS макета нет (там 19 глифов, стрелки
 *    возврата среди них не было), поэтому путь объявлен в этом файле, а не
 *    добавлен в общий набор витрины ради одной строки.
 *
 * В БАЗУ ИДЁТ realChildId — ребёнок из useChildScope, где демо-ветки нет.
 */
import { ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { getChildBalanceEntries, LOCALE_TAG, type ChildBalanceEntry } from "@snr/core";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { EmptyBlock, ErrorBlock, GlassCard, InnerHeader, LoadingBlock } from "../../ui";
import { useAppLocale } from "../../i18n";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useChildScope } from "../../hooks/useChildScope";
import { getSupabase } from "../../lib/supabase";
import { ICONS } from "../../navigation/routes";
import { formatMoney } from "../../utils/format";
import { fullDate, monthYear } from "../../lib/dateLabels";

type Загруженное = { entries: ChildBalanceEntry[]; failed: boolean; complete: boolean };

/** Стрелка возврата. В ICONS макета её нет — держим путь здесь. */
const RETURN_PATHS = ["M9 14 4 9l5-5", "M4 9h10a6 6 0 0 1 0 12h-3"] as const;

const KIND_VISUAL: Record<ChildBalanceEntry["kind"], { color: string; paths: readonly string[] }> = {
  topup: { color: "#059669", paths: ICONS.wallet },
  invoice_charge: { color: "#7c3aed", paths: ICONS.card },
  adjustment: { color: "#2563eb", paths: ICONS.spark },
  refund: { color: "#ef4444", paths: RETURN_PATHS },
};

function Glyph({ paths, size = 16, color = "#fff" }: { paths: readonly string[]; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <Path key={i} d={p} />)}
    </Svg>
  );
}

export function RealPaymentHistoryScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const localeTag = LOCALE_TAG[locale];
  const t = d.parentApp.paymentsWeb;

  const { childId, loading: childLoading } = useChildScope();

  const state = useAsyncData<Загруженное>(
    async () => {
      if (!childId) return { entries: [], failed: false, complete: true };
      const r = await getChildBalanceEntries(getSupabase(), childId);
      return { entries: r.items, failed: r.failed, complete: r.complete };
    },
    [childId],
  );

  const entries = state.data?.entries ?? [];

  const подпись: Record<ChildBalanceEntry["kind"], string> = {
    topup: t.historyTopup,
    invoice_charge: t.historyCharge,
    adjustment: t.historyAdjust,
    refund: t.historyRefund,
  };

  // Группировка по месяцу. Порядок пришёл из запроса (created_at по убыванию)
  // — достаточно его не ломать, пересортировка не нужна.
  const месяцы: { key: string; label: string; rows: ChildBalanceEntry[] }[] = [];
  for (const entry of entries) {
    const key = entry.created_at.slice(0, 7);
    const last = месяцы[месяцы.length - 1];
    if (last && last.key === key) last.rows.push(entry);
    else месяцы.push({ key, label: monthYear(key, localeTag), rows: [entry] });
  }

  const пополнено = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const списано = entries
    .filter((e) => e.amount < 0 && e.kind !== "refund")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const возвраты = entries.filter((e) => e.kind === "refund").reduce((s, e) => s + Math.abs(e.amount), 0);

  const capsSection = {
    fontFamily: fonts.manrope800,
    fontSize: 10.5,
    letterSpacing: 0.08 * 10.5,
    textTransform: "uppercase" as const,
    color: tokens.ink3,
  };
  const capsTotals = {
    fontFamily: fonts.manrope800,
    fontSize: 8,
    letterSpacing: 0.06 * 8,
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.75)",
  };

  return (
    <AppBackground>
      <InnerHeader title={d.parentApp.scr.payHistory} titleSize={15} />

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

        {!state.loading && !state.error && state.data?.failed ? (
          <EmptyBlock title={t.loadFailedTitle} text={t.loadFailedText} />
        ) : null}

        {/* Движений ноль — нормальное состояние: никто не пополнял баланс и
            счета с него не гасились. Молчаливо пустой экран читался бы как
            поломка. */}
        {!state.loading && !state.error && !state.data?.failed && entries.length === 0 ? (
          <EmptyBlock title={t.historyEmptyTitle} text={t.historyEmptyText} />
        ) : null}

        {месяцы.map((месяц) => (
          <View key={месяц.key} style={{ gap: 11 }}>
            <Text style={capsSection}>{месяц.label}</Text>
            {месяц.rows.map((entry) => {
              const visual = KIND_VISUAL[entry.kind];
              const плюс = entry.amount > 0;
              return (
                <GlassCard key={entry.id} radius={18} contentStyle={{ paddingVertical: 11, paddingHorizontal: 13 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 13,
                        backgroundColor: visual.color,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Glyph paths={visual.paths} size={16} />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}
                        >
                          {подпись[entry.kind]}
                        </Text>
                        <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>
                          {fullDate(entry.created_at, localeTag)}
                        </Text>
                      </View>
                      {entry.note ? (
                        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}>
                          {entry.note}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 2 }}>
                        {/* Знак приходит из самой суммы: formatMoney ставит «−»
                            отрицательной, «+» дописываем положительной. */}
                        <Text
                          style={{
                            fontFamily: fonts.manrope800,
                            fontSize: 12.5,
                            color: плюс ? tokens.status.green.text : tokens.ink1,
                          }}
                        >
                          {плюс ? "+" : ""}
                          {formatMoney(entry.amount, { withCurrency: true, currency: d.parentApp.pay.sum })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        ))}

        {entries.length > 0 && state.data?.complete ? (
          <LinearGradient
            colors={["#7c3aed", "#5b21b6"]}
            {...gradPoints(135)}
            style={{ borderRadius: 20, overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row", alignItems: "stretch", gap: 8, padding: 14 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={capsTotals}>{t.historyToppedCap}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#fff" }}>
                  {formatMoney(пополнено)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={capsTotals}>{t.historyChargedCap}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#fff" }}>
                  {formatMoney(списано)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={capsTotals}>{t.historyRefundsCap}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#fff" }}>
                  {formatMoney(возвраты)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

export default RealPaymentHistoryScreen;
