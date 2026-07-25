/**
 * Экран #20 «История оплат» (d20) — Заход 6 REBUILD.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 969–994:
 *  970–974 InnerHeader: back + заголовок 'История оплат' + правая glass-кнопка
 *          с иконкой из 3 горизонтальных линий (фильтр/меню);
 *  975     scroll-контейнер flex:1, gap:11, padding 4/18/118;
 *  976     4 текстовых chip-таба (Все / Обучение / Питание / Другое) —
 *          gt()-стилизация макета (равноширинные, r999, активный — accent-грейд);
 *  977–980 заголовок 'ИЮЛЬ 2026' + список histJul (3 строки);
 *  981–984 заголовок 'ИЮНЬ 2026' + список histJun (3 строки);
 *  985–991 фиолетовая карточка-сводка 3 колонки: ВСЕГО ОПЛАТ / УСПЕШНЫХ /
 *          ВОЗВРАТЫ, разделители 1px rgba(255,255,255,.2).
 *
 * Данные — через аксессоры src/data: getPaymentHistory(), getPaymentHistoryTotals().
 * НИКАКИХ кружков — только Обучение/Питание/Школьная форма/Экскурсия в музей
 * (см. PAYMENT_HISTORY).
 *
 * Реальный интерактив: активный chip-таб — useState, при переключении список
 * фильтруется по r.category ('all' | 'edu' | 'food' | 'other'). Read-only:
 * FAB, поиска, Empty-state и info-иконки на экране НЕТ (согласно extract'у).
 *
 * Обе темы через useTheme(); iOS safe-area — из InnerHeader.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCircleButton, InnerHeader } from "../../ui";
import { getPaymentHistory, getPaymentHistoryTotals } from "../../data";
import type { PaymentHistoryRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../lib/format";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Список три-линии — правая круглая кнопка шапки (макет 973). */
const LIST_PATHS = ["M3 6h18", "M7 12h10", "M10 18h4"];

/** Категории фильтра — 4 chip-таба (макет 976). Порядок важен. */
type FilterKey = "all" | "edu" | "food" | "other";
const FILTER_ITEMS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "edu", label: "Обучение" },
  { key: "food", label: "Питание" },
  { key: "other", label: "Другое" },
];

/* ─── glyph helper ──────────────────────────────────────────────────────── */

function Glyph({
  paths,
  size,
  color,
  stroke = 1.9,
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

/* ─── chip-таб (gt() из макета, строка 3835). ───────────────────────────── */

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  // Активный: accent-градиент + белый текст + тень 0 8 18 rgba(124,58,237,.35).
  // Неактивный: стекло 160° W60→W40 + текст (26,19,74,.66); dark-пара — glass-2
  // (см. SegmentPills). ИСПРАВЛЕНИЕ (пост-заход 8): бордер W75 у неактивной
  // пилюли снят — та же правка, что и в SegmentPills.tsx, применена здесь,
  // т.к. этот чип продублирован вручную и не переиспользует SegmentPills.
  const inactiveColors: [string, string] =
    scheme === "dark"
      ? ["rgba(255,255,255,0.11)", "rgba(255,255,255,0.04)"]
      : ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.4)"];
  const inactiveText =
    scheme === "dark" ? "rgba(255,255,255,0.68)" : "rgba(26,19,74,0.66)";

  const activeShadow =
    scheme === "dark"
      ? tokens.shColor("124,58,237")
      : { x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" };

  if (active) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.chipWrap, shadowStyle(activeShadow), { borderRadius: 999 }]}
      >
        <LinearGradient
          colors={tokens.accentGrad.colors as [string, string]}
          {...gradPoints(tokens.accentGrad.angle)}
          style={styles.chipInner}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.chipWrap}>
      <LinearGradient
        colors={inactiveColors}
        {...gradPoints(scheme === "dark" ? 135 : 160)}
        style={styles.chipInner}
      >
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 11.5,
            color: inactiveText,
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ─── 38×38 икон-плитка с category-градиентом (макет billIc → 3780). ────── */

function CategoryIcon({ row }: { row: PaymentHistoryRow }) {
  return (
    <View
      style={[
        styles.iconTile,
        shadowStyle({ x: 0, y: 6, blur: 14, color: `${row.gradient[1]}44` }),
      ]}
    >
      <LinearGradient
        colors={row.gradient}
        {...gradPoints(135)}
        style={StyleSheet.absoluteFill}
      />
      <Glyph paths={row.icon_paths} size={16} color="#FFFFFF" stroke={1.9} />
    </View>
  );
}

/* ─── строка истории (макет 979/983). ───────────────────────────────────── */

function HistoryRow({ row }: { row: PaymentHistoryRow }) {
  const { tokens, scheme } = useTheme();
  const isRefund = row.is_refund;

  const successColor = scheme === "dark" ? "#34d399" : "#047857";
  const refundColor = scheme === "dark" ? "#fca5a5" : "#b91c1c";
  const statusColor = isRefund ? refundColor : successColor;
  const sumColor = isRefund ? refundColor : tokens.ink1;

  const noteColor =
    scheme === "dark" ? "rgba(255,255,255,0.62)" : "rgba(26,19,74,0.62)";
  const dateColor =
    scheme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(26,19,74,0.5)";

  const sumTxt = `${isRefund ? "−" : ""}${formatMoney(Math.abs(row.amount))} сум`;

  return (
    <View style={[styles.rowCard, shadowStyle(tokens.shCard)]}>
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
            : ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.46)"]
        }
        {...gradPoints(160)}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: tokens.glassInset.y,
          backgroundColor: tokens.glassInset.color,
        }}
      />
      <View style={styles.rowContent}>
        <CategoryIcon row={row} />
        <View style={styles.rowCenter}>
          <View style={styles.rowTop}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: tokens.ink1,
                flex: 1,
                minWidth: 0,
              }}
              numberOfLines={1}
            >
              {row.title}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 9,
                color: dateColor,
                flexShrink: 0,
              }}
            >
              {row.date_label}
            </Text>
          </View>
          <Text
            style={{ fontFamily: fonts.manrope600, fontSize: 10, color: noteColor }}
            numberOfLines={1}
          >
            {row.note}
          </Text>
          <View style={styles.rowBottom}>
            <Text
              style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: statusColor }}
            >
              {isRefund ? "Возврат" : "Успешно"}
            </Text>
            <Text
              style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: sumColor }}
            >
              {sumTxt}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── month-header (макет 977/981, histHdr → 3795). ─────────────────────── */

function MonthHeader({ label, visible }: { label: string; visible: boolean }) {
  const { scheme } = useTheme();
  if (!visible) return null;
  const color = scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)";
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 0.84, // 0.08em ≈ 8% of 10.5 (RN letterSpacing — абс. значение)
        color,
      }}
    >
      {label}
    </Text>
  );
}

/* ─── totals summary card (макет 985–991). ──────────────────────────────── */

function TotalsCol({
  label,
  value,
  flex,
}: {
  label: string;
  value: string;
  flex: number;
}) {
  return (
    <View style={{ flex, flexDirection: "column", gap: 2 }}>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 8,
          letterSpacing: 0.48, // 0.06em ≈ 6% of 8
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 12.5,
          color: "#FFFFFF",
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function TotalsCard({
  total,
  successful,
  refunds,
}: {
  total: number;
  successful: number;
  refunds: number;
}) {
  return (
    <View
      style={[
        styles.totalsCard,
        shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(91,33,182,0.35)" }),
      ]}
    >
      <LinearGradient
        colors={["#7c3aed", "#5b21b6"]}
        {...gradPoints(135)}
        style={StyleSheet.absoluteFill}
      />
      {/* inset highlight 1.5px белый .35 (макет 985). */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          backgroundColor: "rgba(255,255,255,0.35)",
        }}
      />
      <View style={styles.totalsContent}>
        <TotalsCol label="ВСЕГО ОПЛАТ" value={formatMoney(total)} flex={1.2} />
        <View style={styles.totalsDivider} />
        <TotalsCol label="УСПЕШНЫХ" value={formatMoney(successful)} flex={1.2} />
        <View style={styles.totalsDivider} />
        <TotalsCol label="ВОЗВРАТЫ" value={formatMoney(refunds)} flex={1} />
      </View>
    </View>
  );
}

/* ═══ Экран ═══════════════════════════════════════════════════════════════ */

export default function PaymentHistoryScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const history = getPaymentHistory();
  const totals = getPaymentHistoryTotals();

  const [filter, setFilter] = useState<FilterKey>("all");

  const filterFn = (r: PaymentHistoryRow) =>
    filter === "all" || r.category === filter;

  const julVisible = useMemo(() => history.jul.filter(filterFn), [history.jul, filter]);
  const junVisible = useMemo(() => history.jun.filter(filterFn), [history.jun, filter]);

  return (
    <AppBackground>
      <InnerHeader
        title={d.parentApp.scr.payHistory}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("stub", { stubKey: "help" })}>
            <Glyph paths={LIST_PATHS} size={16} color={tokens.ink1} stroke={1.8} />
          </GlassCircleButton>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* 4 chip-таба фильтра (макет 976). */}
        <View style={styles.chipsRow}>
          {FILTER_ITEMS.map((it) => (
            <FilterChip
              key={it.key}
              label={it.label}
              active={filter === it.key}
              onPress={() => setFilter(it.key)}
            />
          ))}
        </View>

        {/* ИЮЛЬ 2026 + строки. */}
        <MonthHeader label="ИЮЛЬ 2026" visible={julVisible.length > 0} />
        {julVisible.map((row, i) => (
          <HistoryRow key={`jul-${i}-${row.title}`} row={row} />
        ))}

        {/* ИЮНЬ 2026 + строки. */}
        <MonthHeader label="ИЮНЬ 2026" visible={junVisible.length > 0} />
        {junVisible.map((row, i) => (
          <HistoryRow key={`jun-${i}-${row.title}`} row={row} />
        ))}

        {/* Фиолетовая summary-карточка (макет 985–991). */}
        <TotalsCard
          total={totals.total}
          successful={totals.successful}
          refunds={totals.refunds}
        />
      </ScrollView>
    </AppBackground>
  );
}

/* ─── стили. ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  chipsRow: {
    flexDirection: "row",
    gap: 6,
  },
  chipWrap: {
    flex: 1,
    borderRadius: 999,
  },
  chipInner: {
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  rowCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    gap: 1,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalsCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  totalsContent: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  totalsDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "stretch",
  },
});
