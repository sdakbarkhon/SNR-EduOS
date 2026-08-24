/**
 * Экран #21 «Чеки и invoices» (d21) — Заход 6 REBUILD.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 995–1031:
 *  996–1001  TopBar: back (18) + заголовок Unbounded 15/600 + Search-кнопка
 *            (лупа 15, stroke 2) + FiltersMenu-кнопка (три горизонтальные
 *            линии 16, stroke 1.8). Три кнопки — GlassCircleButton 38 в
 *            общем ряду; back и Filter-меню слева/справа, между ними ещё
 *            одна круглая glass-кнопка (Search). InnerHeader принимает
 *            только один правый слот — поэтому оборачиваем 2 кнопки в
 *            общий View.
 *  1002      ScrollArea: gap 11, padding 4/18/(118 под таб-бар).
 *  1003      SegmentedTabs: два pill-таба «Чеки» / «Invoices» (gap 7,
 *            равноширинные — сегмент gt() из макета). isChecks / isInv —
 *            локальный state с ONE_HOT-переключением. Реализованы через
 *            SegmentPills scrollable=false.
 *  1004–1015 ChecksBranch: sc-if isChecks — колонка с двумя месячными
 *            группами (Июль/Июнь).
 *  1006/1010 MonthLabel «ИЮЛЬ 2026» / «ИЮНЬ 2026»: 10.5/800/.08em/ink3.
 *  1007–1013 ReceiptList: по месяцам — карточки-строки (r.st + r.ic).
 *            Каждая строка: контейнер glass-row (padding 12/12, radius 16,
 *            border) с иконкой-плиткой 38 (gradient 135°, белый глиф) в
 *            левом торце; центральная колонка (top-row: name+date через
 *            space-between; num-строка ink3; sum-строка ink1 12/800);
 *            справа круглая 32×32 фиолетовая кнопка-скачать (icon —
 *            стрелка вниз + подчёркивание, onClick → dl-стаб).
 *  1016–1027 InvoicesBranch: sc-if isInv — та же структура, две группы
 *            (Июль/Июнь).
 *  1028–1030 InfoNotice (общий, ПОСЛЕ обеих sc-if): синий info-banner
 *            (padding 12/14, radius 18, bg rgba(59,130,246,.1),
 *            border rgba(59,130,246,.3)) со щитом-check иконкой (17×17
 *            stroke #1d4ed8) и текстом 10/600/1.55/ink2.
 *
 * Данные: RECEIPTS через getReceipts() — единый источник. Для иконок и
 * градиентов на RECEIPTS маппим по ключевому слову title → BILLS (edu →
 * violet-gradient/mortarboard; food → green/utensils; form → blue/shirt;
 * exc/возврат → pink/pin) — RECEIPTS такие поля не несут, а формат макета
 * требует единый набор из 4 категорий (никаких кружков — только Обучение /
 * Питание / Школьная форма / Экскурсия в музей). Форматирование сумм —
 * formatMoney(withCurrency, d.parentApp.pay.sum).
 *
 * Ring/RingSegmented/FAB/чекбоксы/radio/тумблеры/поля ввода — на экране
 * НЕТ (правило блок-листа). Обе темы через tokens; iOS safe-area — из
 * InnerHeader (paddingTop max(insets.top, 46)).
 *
 * Навигация: back → goBack; search → 'da6'; filter-menu — no-op заглушка
 * (в маркете вызов goHelp, но глиф — три линии, аналогично AllSubjects
 * §comment); goFile-download → stub «file».
 *
 * 15.08.2026 (оплаты). Сверху — плашка «это пример». Кнопка-«фильтр» в шапке
 * удалена: она была молчаливым no-op, а фильтр по виду документа уже есть
 * вкладками. «Скачать» объясняет, что файлов чеков в школе не хранится.
 * Даты и номера документов собираются по локали из data/demoPayments.ts.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  GlassCircleButton,
  InnerHeader,
  SegmentPills,
} from "../../ui";
import { AppBackground, fonts, gradPoints, useTheme, type ThemeTokens } from "../../theme";
import { useAppLocale } from "../../i18n";
import { DemoBanner, SoonNote } from "./parts";
import { getBills } from "../../data";
import { monthLabel, receiptsFor } from "../../data/demoPayments";
import { LOCALE_TAG } from "@snr/core";
import type { BillRow, ReceiptRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { formatMoney } from "../../utils/format";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── icons / глифы ─────────────────────────────────────────────────────── */

const SEARCH_PATHS = ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"];
const DOWNLOAD_PATHS = ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"];
const SHIELD_CHECK_PATHS = [
  "M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z",
  "m9 12 2 2 4-4",
];

function Glyph({
  paths,
  size,
  color,
  stroke = 2,
}: {
  paths: string[];
  size: number;
  color: string;
  stroke?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/* ─── mapping receipt.title → bill visual (иконка + градиент) ──────────── */

/**
 * RECEIPTS у нас без визуальных полей — маппим на BILLS по ключевому слову
 * в title. Правило заказчика: только 4 позиции (Обучение / Питание /
 * Школьная форма / Экскурсия в музей); «Возврат · экскурсия» и «Экскурсия
 * в музей» → категория exc. Никаких дополнительных «кружков».
 */
function resolveBillVisual(
  title: string,
  bills: BillRow[],
): Pick<BillRow, "gradient" | "icon_paths"> {
  const t = title.toLowerCase();
  const pick = (id: BillRow["id"]) => {
    const b = bills.find((x) => x.id === id)!;
    return { gradient: b.gradient, icon_paths: b.icon_paths };
  };
  if (t.startsWith("обучение")) return pick("edu");
  if (t.startsWith("питание")) return pick("food");
  if (t.includes("форма")) return pick("form");
  // «Возврат · экскурсия», «Экскурсия в музей»
  return pick("exc");
}

/* ─── row-tile 38×38 (gradient 135° + белый глиф) ──────────────────────── */

function IconTile({
  gradient,
  paths,
}: {
  gradient: [string, string];
  paths: string[];
}) {
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{
        width: 38,
        height: 38,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </Svg>
    </LinearGradient>
  );
}

/* ─── uppercase month label (10.5/800/.08em/ink3) ──────────────────────── */

function MonthLabel({ label, tokens }: { label: string; tokens: ThemeTokens }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 0.08 * 10.5,
        textTransform: "uppercase",
        color: tokens.ink3,
      }}
    >
      {label}
    </Text>
  );
}

/* ─── ReceiptRow (строка чека/инвойса) ─────────────────────────────────── */

interface ReceiptListRowProps {
  receipt: ReceiptRow;
  bills: BillRow[];
  currency: string;
  onDownload: () => void;
  tokens: ThemeTokens;
}

function ReceiptListRow({ receipt, bills, currency, onDownload, tokens }: ReceiptListRowProps) {
  const visual = resolveBillVisual(receipt.title, bills);
  const rowBg =
    tokens.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";
  const rowBorder =
    tokens.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.80)";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 16,
        backgroundColor: rowBg,
        borderWidth: 1,
        borderColor: rowBorder,
      }}
    >
      <IconTile gradient={visual.gradient} paths={visual.icon_paths} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 12,
              color: tokens.ink1,
              flexShrink: 1,
            }}
          >
            {receipt.title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 9,
              color: tokens.ink3,
              flexShrink: 0,
            }}
          >
            {receipt.date_label}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 9.5,
            color: tokens.ink2,
          }}
        >
          {receipt.number_label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 11.5,
            color: tokens.ink1,
            marginTop: 1,
          }}
        >
          {formatMoney(receipt.amount, { withCurrency: true, currency })}
        </Text>
      </View>
      <Pressable
        onPress={onDownload}
        hitSlop={6}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(139,92,246,0.14)",
          borderWidth: 1,
          borderColor: "rgba(139,92,246,0.35)",
        }}
      >
        <Glyph paths={DOWNLOAD_PATHS} size={13} color="#6d28d9" stroke={2} />
      </Pressable>
    </View>
  );
}

/* ─── экран ─────────────────────────────────────────────────────────────── */

export default function ReceiptsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const navigation = useNavigation<Nav>();

  // Локальный state: 0 = «Чеки», 1 = «Invoices». One-hot переключение
  // (isChecks / isInv в макете).
  const [tabIndex, setTabIndex] = useState<0 | 1>(0);
  const isChecks = tabIndex === 0;

  // Фильтруем один раз (данные из фикстур — стабильны).
  const bills = getBills();
  const localeTag = LOCALE_TAG[locale];
  const allReceipts = receiptsFor(localeTag, {
    check: d.parentApp.pay2.receiptsChecks,
    invoice: d.parentApp.pay2.receiptsInvoices,
  });
  const julChecks = allReceipts.filter((r) => r.kind === "check" && r.month === "jul");
  const junChecks = allReceipts.filter((r) => r.kind === "check" && r.month === "jun");
  const julInv = allReceipts.filter((r) => r.kind === "invoice" && r.month === "jul");
  const junInv = allReceipts.filter((r) => r.kind === "invoice" && r.month === "jun");

  const currency = d.parentApp.pay.sum;

  const goBack = () => navigation.goBack();
  const goSearch = () => navigation.navigate("da6");
  // Файлов чеков в школе не хранится — «Скачать» объясняет это, а не
  // открывает пустой просмотрщик.
  const [fileSoon, setFileSoon] = useState(false);
  const goFile = () => setFileSoon((v) => !v);
  // Кнопка-«фильтр» в шапке удалена: она была молчаливым no-op, а фильтр по
  // виду документа уже есть вкладками «Чеки / Счета» прямо под шапкой.

  // Заголовки месяцев — по локали, а не готовой русской строкой.
  const monthJul2026 = monthLabel("2026-07-01", localeTag).toUpperCase();
  const monthJun2026 = monthLabel("2026-06-01", localeTag).toUpperCase();

  const infoBannerBg = "rgba(59,130,246,0.10)";
  const infoBannerBorder = "rgba(59,130,246,0.30)";
  const infoText =
    "Все документы хранятся в электронном виде и доступны в любой момент. Любой чек или счёт можно скачать в PDF и отправить на почту.";

  return (
    <AppBackground>
      {/* 1. TopBar: back + title + Search + FiltersMenu. */}
      <InnerHeader
        title={d.parentApp.scr.receipts}
        titleSize={15}
        onBackPress={goBack}
        right={
          <GlassCircleButton onPress={goSearch}>
            <Glyph paths={SEARCH_PATHS} size={15} color={tokens.ink1} stroke={2} />
          </GlassCircleButton>
        }
      />

      {/* 2. ScrollArea. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: 11,
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
        }}
      >
        <DemoBanner text={d.parentApp.pay2.demoBanner} />

        {/* 3. SegmentedTabs Чеки / Invoices. */}
        <SegmentPills
          items={["Чеки", "Invoices"]}
          activeIndex={tabIndex}
          onChange={(i) => setTabIndex(i === 0 ? 0 : 1)}
        />

        {/* 4. ChecksBranch (sc-if isChecks). */}
        {isChecks ? (
          <View style={styles.branchColumn}>
            {/* 5. Month label Июль 2026. */}
            <MonthLabel label={monthJul2026} tokens={tokens} />
            {/* 6. ReceiptList July (чеки). */}
            {julChecks.map((r) => (
              <ReceiptListRow
                key={r.number_label}
                receipt={r}
                bills={bills}
                currency={currency}
                onDownload={goFile}
                tokens={tokens}
              />
            ))}
            {/* 7. Month label Июнь 2026. */}
            <MonthLabel label={monthJun2026} tokens={tokens} />
            {/* 8. ReceiptList June (чеки). */}
            {junChecks.map((r) => (
              <ReceiptListRow
                key={r.number_label}
                receipt={r}
                bills={bills}
                currency={currency}
                onDownload={goFile}
                tokens={tokens}
              />
            ))}
          </View>
        ) : null}

        {/* 9. InvoicesBranch (sc-if isInv). */}
        {!isChecks ? (
          <View style={styles.branchColumn}>
            {/* 10. Month label Июль 2026. */}
            <MonthLabel label={monthJul2026} tokens={tokens} />
            {/* 11. InvoiceList July. */}
            {julInv.map((r) => (
              <ReceiptListRow
                key={r.number_label}
                receipt={r}
                bills={bills}
                currency={currency}
                onDownload={goFile}
                tokens={tokens}
              />
            ))}
            {/* 12. Month label Июнь 2026. */}
            <MonthLabel label={monthJun2026} tokens={tokens} />
            {/* 13. InvoiceList June. */}
            {junInv.map((r) => (
              <ReceiptListRow
                key={r.number_label}
                receipt={r}
                bills={bills}
                currency={currency}
                onDownload={goFile}
                tokens={tokens}
              />
            ))}
          </View>
        ) : null}

        {fileSoon ? <SoonNote text={d.parentApp.pay2.soonFile} /> : null}

        {/* 14. InfoNotice (общий для обеих веток, после sc-if). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: infoBannerBg,
            borderWidth: 1,
            borderColor: infoBannerBorder,
          }}
        >
          <Glyph
            paths={SHIELD_CHECK_PATHS}
            size={17}
            color="#1d4ed8"
            stroke={1.9}
          />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: tokens.ink2,
            }}
          >
            {infoText}
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  branchColumn: {
    flexDirection: "column",
    gap: 11,
  },
});
