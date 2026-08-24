/**
 * Экран #18 «Счета к оплате» (d18) — Заход 6 REBUILD.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 908–938:
 *  909–913  TopBar: back (38 glass) + Unbounded 15/600 «Счета к оплате» + help (38 glass);
 *  914      скролл-контейнер (padding 4/18/118, gap 12);
 *  915–918  SummaryCard (glass 20/13x14): «2 счёта» + Unbounded 23/600 «4 950 000 сум»;
 *  919–924  MainBillsList (edu/food): верхняя секция (icon + name/note + сумма + чекбокс)
 *           + нижняя секция (calendar + «Срок оплаты: …»);
 *  925–928  TotalCard: «Итого к оплате» / сумма (динамика);
 *  929      PayAll CTA (градиент purple, disabled при пустом выборе — правило заказчика);
 *  930–931  Секция «ДРУГИЕ СЧЕТА» с обёрткой;
 *  932–934  OtherBillsList (form/exc): compact-строка (icon + name/due + sum + круглая +кнопка);
 *  936      DownloadAllPdf — outline-кнопка «Скачать все счета (PDF)».
 *
 * ИНТЕРАКТИВ (правила заказчика): чекбоксы edu/food управляют выбором и
 * пересчётом «Итого» + PayAll CTA (пусто → неактивна); +кнопки form/exc
 * добавляют позицию в основной список (сдвигают в main + чекают).
 *
 * Данные — ДОСЛОВНО из фикстур getBills(): edu 4 500 000 + food 450 000
 * = 4 950 000 (стартовый выбор), form 350 000, exc 150 000 в «других».
 * Никаких кружков-циферок — иконки b.ic обозначают предмет (Обучение,
 * Питание, Школьная форма, Экскурсия в музей).
 *
 * i18n: заголовок — d.parentApp.scr.bills. Обе темы — через useTheme();
 * iOS safe-area — из InnerHeader; тени/стекло — токенами.
 *
 * 15.08.2026 (оплаты). Сверху — плашка «данных нет, это пример». Кнопка
 * «Оплатить» больше не ведёт на выдуманный checkout с поддельной шторкой
 * «Платёж проведён»: платёжной системы нет, и кнопка объясняет это под собой.
 * «Скачать» — так же. Подпись строки собирается из НАСТОЯЩЕГО ребёнка, срок
 * оплаты форматируется по локали (в фикстуре он лежал строкой «5 августа
 * 2026»). Данные — из data/demoPayments.ts.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCircleButton, InnerHeader } from "../../ui";
import { BILLS, BILL_META } from "../../data/demoPayments";
import { useChildScope } from "../../hooks/useChildScope";
import { fullDate } from "../../lib/dateLabels";
import { DemoBanner, SoonNote } from "./parts";
import type { BillRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../utils/format";
import { format, LOCALE_TAG } from "@snr/core";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── Мини-глиф (белые линии). ─────────────────────────────────────────────── */

function IconGlyph({
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

/* ─── Иконка-плитка предмета (без «кружка-циферки»). ──────────────────────── */

function BillIconTile({
  gradient,
  paths,
  size = 38,
  radius = 13,
  glyphSize = 18,
}: {
  gradient: [string, string];
  paths: string[];
  size?: number;
  radius?: number;
  glyphSize?: number;
}) {
  const g = gradPoints(135);
  // Цветная «под предмет» тень — как box-shadow макета.
  const shadow = shadowStyle({
    x: 0,
    y: 6,
    blur: 14,
    color: "rgba(124,58,237,0.22)",
  });
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        shadow,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <IconGlyph paths={paths} size={glyphSize} color="#FFFFFF" stroke={1.9} />
    </View>
  );
}

/* ─── Glass-обёртка (карточка списка, макет 920/925). ─────────────────────── */

function GlassSurface({
  children,
  contentStyle,
  onPress,
  disabled,
  radius = 20,
}: {
  children: React.ReactNode;
  contentStyle?: React.ComponentProps<typeof View>["style"];
  onPress?: () => void;
  disabled?: boolean;
  radius?: number;
}) {
  const { tokens, scheme } = useTheme();

  const gradientColors: [string, string] =
    scheme === "dark"
      ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
      : ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.46)"];

  const body = (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: 1,
          borderColor:
            scheme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.78)",
        },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        {...gradPoints(160)}
        style={StyleSheet.absoluteFill}
      />
      {/* inset-блик стекла — верхняя hairline-полоска. */}
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
      <View style={contentStyle}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [shadowStyle(tokens.shCard), pressed ? { opacity: 0.9 } : null]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={shadowStyle(tokens.shCard)}>{body}</View>;
}

/* ─── Чекбокс с галочкой (макет 921: b.ckSt). ─────────────────────────────── */

function CheckSquare({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  const { scheme } = useTheme();
  const g = gradPoints(135);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 22,
          height: 22,
          borderRadius: 7,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: checked ? 0 : 1.5,
          borderColor:
            scheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(23,18,67,0.25)",
          backgroundColor: checked
            ? undefined
            : scheme === "dark"
              ? "rgba(255,255,255,0.06)"
              : "rgba(255,255,255,0.6)",
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {checked ? (
        <>
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            start={g.start}
            end={g.end}
            style={StyleSheet.absoluteFill}
          />
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M20 6 9 17l-5-5" />
          </Svg>
        </>
      ) : null}
    </Pressable>
  );
}

/* ─── Круглая +кнопка (макет 933). ────────────────────────────────────────── */

function AddCircleButton({ onPress }: { onPress: () => void }) {
  const g = gradPoints(135);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 30,
          height: 30,
          borderRadius: 15,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(124,58,237,0.35)" }),
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <LinearGradient
        colors={["#7c3aed", "#4f6df5"]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M12 5v14" />
        <Path d="M5 12h14" />
      </Svg>
    </Pressable>
  );
}

/* ─── PayAll CTA (макет 929). ─────────────────────────────────────────────── */

function PayAllButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const g = gradPoints(135);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: 16,
          overflow: "hidden",
          height: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.5 : 1,
        },
        shadowStyle({ x: 0, y: 10, blur: 22, color: "rgba(124,58,237,0.4)" }),
        pressed && !disabled ? { opacity: 0.9 } : null,
      ]}
    >
      <LinearGradient
        colors={["#7c3aed", "#4f6df5"]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Rect x={2} y={5} width={20} height={14} rx={3} />
        <Path d="M2 10h20" />
      </Svg>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#fff" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Download-all PDF (outline, макет 936). ──────────────────────────────── */

function DownloadPdfButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { scheme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: 15,
          paddingVertical: 13,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor:
            scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)",
          borderWidth: 1.5,
          borderColor: "rgba(124,58,237,0.45)",
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <Svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6d28d9"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M12 3v12" />
        <Path d="m7 10 5 5 5-5" />
        <Path d="M5 21h14" />
      </Svg>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#6d28d9" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Иконка «календарь» / «help». ────────────────────────────────────────── */

const CAL_PATHS = ["M8 2v4", "M16 2v4", "M3 10h18"];

const HELP_PATHS = ["M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"];

/* ═══ Экран ═══════════════════════════════════════════════════════════════ */

export default function BillsScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();
  const currency = d.parentApp.pay.sum;

  const bills = BILLS;
  // Подпись строки собирается из НАСТОЯЩЕГО ребёнка родителя: в общем моке
  // она содержит чужую демо-семью («Малика · 7-А»), а у родителя свой ребёнок.
  const { child } = useChildScope();
  const who = child ? `${child.first_name} · ${child.class_name}` : "";
  const [paySoon, setPaySoon] = useState(false);
  const [fileSoon, setFileSoon] = useState(false);

  // Стартовое состояние — из фикстур (edu/food в main + отмечены, form/exc в other).
  // Дальше состояние управляется локально: чекбокс тогглит выбор основных;
  // +кнопка в other переводит счёт в основной список и сразу отмечает.
  const [inMainIds, setInMainIds] = useState<string[]>(() =>
    bills.filter((b) => b.in_main_list).map((b) => b.id),
  );
  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    bills.filter((b) => b.in_main_list && b.checked_by_default).map((b) => b.id),
  );

  const isInMain = useCallback((id: string) => inMainIds.indexOf(id) >= 0, [inMainIds]);
  const isChecked = useCallback((id: string) => checkedIds.indexOf(id) >= 0, [checkedIds]);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) =>
      prev.indexOf(id) >= 0 ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const addToMain = useCallback((id: string) => {
    setInMainIds((prev) => (prev.indexOf(id) >= 0 ? prev : [...prev, id]));
    setCheckedIds((prev) => (prev.indexOf(id) >= 0 ? prev : [...prev, id]));
  }, []);

  const mainBills = useMemo<BillRow[]>(
    () => bills.filter((b) => isInMain(b.id)),
    [bills, isInMain],
  );
  const otherBills = useMemo<BillRow[]>(
    () => bills.filter((b) => !isInMain(b.id)),
    [bills, isInMain],
  );

  const selectedSum = useMemo(
    () =>
      bills
        .filter((b) => isInMain(b.id) && isChecked(b.id))
        .reduce((s, b) => s + b.amount, 0),
    [bills, isInMain, isChecked],
  );
  const selectedCount = checkedIds.filter((id) => isInMain(id)).length;

  const billTotalBig = `${formatMoney(selectedSum)} ${currency}`;
  // «N счёт(а/ов)» — макет использует шаблон d.parentApp.pay.billsChip = «{n} счёта».
  const billCountLabel = d.parentApp.pay.billsChip.replace("{n}", String(selectedCount));

  // Мьютд-цвета в зависимости от темы.
  const muted = scheme === "dark" ? "rgba(255,255,255,0.62)" : "rgba(26,19,74,0.62)";
  const mutedSofter = scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.55)";
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.07)";
  const otherWrapVisible = otherBills.length > 0;
  const payDisabled = selectedCount === 0;

  return (
    <AppBackground>
      <InnerHeader
        title={d.parentApp.scr.bills}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("stub", { stubKey: "help" })}>
            <IconGlyph paths={HELP_PATHS} size={16} color={tokens.ink1} stroke={2} />
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        <DemoBanner text={d.parentApp.pay2.demoBanner} />

        {/* 1. SummaryCard — количество счетов + крупная сумма (макет 915–918). */}
        <GlassSurface contentStyle={styles.summaryCardContent}>
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: muted }}>
            {billCountLabel}
          </Text>
          <Text
            style={{
              fontFamily: fonts.unbounded600,
              fontSize: 23,
              color: tokens.ink1,
            }}
          >
            {billTotalBig}
          </Text>
        </GlassSurface>

        {/* 2. MainBillsList — основные счета с чекбоксами (макет 919–924). */}
        {mainBills.map((b) => (
          <GlassSurface key={b.id} contentStyle={styles.mainRowContent}>
            {/* Верхняя секция: иконка + название/note + сумма + чекбокс. */}
            <View style={styles.mainRowTop}>
              <BillIconTile gradient={b.gradient} paths={b.icon_paths} />
              <View style={styles.mainRowCenter}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
                >
                  {b.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ fontFamily: fonts.manrope600, fontSize: 10, color: muted }}
                >
                  {[who, BILL_META[b.id]?.noteTail].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 13,
                  color: "#b91c1c",
                }}
              >
                {`${formatMoney(b.amount)} ${currency}`}
              </Text>
              <CheckSquare checked={isChecked(b.id)} onPress={() => toggleChecked(b.id)} />
            </View>
            {/* Нижняя секция: календарь + «Срок оплаты …». */}
            <View
              style={[
                styles.mainRowBottom,
                { borderTopColor: dividerColor },
              ]}
            >
              <Svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke={mutedSofter}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M8 2v4" />
                <Path d="M16 2v4" />
                <Rect x={3} y={4} width={18} height={17} rx={4} />
                <Path d="M3 10h18" />
              </Svg>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: muted }}>
                {`${d.parentApp.pay.billDueBy.replace("{date}", fullDate(BILL_META[b.id].dueDate, localeTag))}`}
              </Text>
            </View>
          </GlassSurface>
        ))}

        {/* 3. TotalCard — «Итого к оплате» + сумма (макет 925–928). */}
        <GlassSurface contentStyle={styles.totalCardContent}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
            Итого к оплате
          </Text>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: tokens.ink1 }}>
            {billTotalBig}
          </Text>
        </GlassSurface>

        {/* 4. PayAll CTA. Раньше вела на выдуманный checkout с поддельной
            шторкой «Платёж проведён»; платёжной системы нет, поэтому кнопка
            объясняет это прямо под собой, а не изображает оплату. */}
        <View>
          <PayAllButton
            label={format(d.parentApp.pay2.payAll, { sum: billTotalBig })}
            onPress={() => setPaySoon((v) => !v)}
            disabled={payDisabled}
          />
          {paySoon && !payDisabled ? <SoonNote text={d.parentApp.pay2.soon} /> : null}
        </View>

        {/* 5. Секция «ДРУГИЕ СЧЕТА» (макет 930). Скрываем, если список пуст. */}
        {otherWrapVisible ? (
          <>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10,
                letterSpacing: 0.9,
                textTransform: "uppercase",
                color: mutedSofter,
                marginTop: 6,
              }}
            >
              ДРУГИЕ СЧЕТА
            </Text>
            <View style={{ gap: 8 }}>
              {otherBills.map((b) => (
                <GlassSurface key={b.id} contentStyle={styles.otherRowContent}>
                  <BillIconTile
                    gradient={b.gradient}
                    paths={b.icon_paths}
                    size={34}
                    radius={11}
                    glyphSize={16}
                  />
                  <View style={styles.otherRowCenter}>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}
                    >
                      {b.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: mutedSofter }}
                    >
                      {fullDate(BILL_META[b.id].dueDate, localeTag)}
                    </Text>
                  </View>
                  <Text
                    style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
                  >
                    {`${formatMoney(b.amount)} ${currency}`}
                  </Text>
                  <AddCircleButton onPress={() => addToMain(b.id)} />
                </GlassSurface>
              ))}
            </View>
          </>
        ) : null}

        {/* 6. Скачивание счетов. Файлов у школы не хранится — кнопка говорит
            об этом, а не открывает пустую заглушку. */}
        <View>
          <DownloadPdfButton
            label={d.parentApp.pay2.receiptDownload}
            onPress={() => setFileSoon((v) => !v)}
          />
          {fileSoon ? <SoonNote text={d.parentApp.pay2.soonFile} /> : null}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

/* ─── стили. ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  summaryCardContent: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 3,
  },
  mainRowContent: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 9,
  },
  mainRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  mainRowCenter: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mainRowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  totalCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  otherRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  otherRowCenter: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
