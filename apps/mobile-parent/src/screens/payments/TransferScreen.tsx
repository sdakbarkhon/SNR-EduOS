/**
 * Экран «Перевод между кошельками» (dtransfer) — REBUILD (Заход 6,
 * block-by-block из макета «SNR EduOS v2 Light.dc.html», строки 1764–1798).
 *
 * BLOCK-LIST (сверху вниз, 10 блоков в двух родителях: header + scroll):
 *   1. Header — Back-кнопка (glass-круг 38) + заголовок «Перевод между
 *      кошельками» (Unbounded 14/600 #171243). padding 46/18/8, gap 12.
 *      Ни InnerHeader (у него 15/16px), ни RootHeader (17px без back)
 *      не подходят по типографике — собираем шапку локально.
 *   2. Scroll container — padding 4/18/118, gap 10 (учтён нижний FloatingTabBar).
 *   3. Section caption «ОТКУДА» (10.5/800 letter-spacing .08em).
 *   4. FROM card (Glass, кликабельна → openSheet выбора ребёнка).
 *   5. Swap button — круглый градиент 38×38 (135° #7c3aed→#4f6df5),
 *      меняет FROM ↔ TO. Единственный акцентный элемент до CTA.
 *   6. Section caption «КУДА».
 *   7. TO card (Glass, НЕ кликабельна — асимметрия по мокапу).
 *   8. Amount card:
 *       8a. Caption «СУММА ПЕРЕВОДА»
 *       8b. Input 24/600 + «сум» 13/700
 *       8c. Строка доступности: «Доступно: X сум» / «Недостаточно средств»
 *       8d. Ряд быстрых чипов (10 000 / 25 000 / 50 000 / Всё)
 *   9. CTA «Перевести {sum}» — динамический стиль (disabled при пустом/
 *      невалидном поле), градиент 135°, тень 0 14 32 rgba(124,58,237,.4).
 *   10. Info banner (зелёный, rgba(16,185,129,.1) фон + иконка zap):
 *      «Перевод мгновенный и без комиссии...»
 *
 * ВАЖНОЕ по интерактиву (макет 4144–4160):
 *  - trChips: [10000, 25000, 50000, null] — null = trFromBal («Всё»);
 *  - trInput: только цифры, максимум 8 (макет: .slice(0, 8));
 *  - trAvail: красный, если +val > balance;
 *  - trBtnStyle: enabled при 0 < val ≤ balance, disabled иначе;
 *  - trSwap: swap FROM ↔ TO;
 *  - doTransfer: списываем с FROM, зачисляем на TO (локальный state
 *    balances[]), сбрасываем val и goBack. В проде — success sheet + запись
 *    операции в БД (см. mock 3958). Здесь sheet-of-success не собираем:
 *    он общий, будет отдельным Заходом.
 *  - openSheet FROM: выбор источника; при выборе того же id, что и TO,
 *    reassign TO на первого другого ребёнка семьи (иначе перевод самому себе).
 *
 * Данные — фикстуры через accessors: getChildren + getWalletBalance
 * (первоначальное состояние баланса). При единственном ребёнке в семье
 * экран нерабочий по смыслу (нет кому переводить) — CTA всегда disabled,
 * TO пуст. Info-banner уже это объясняет: «переводить можно только между
 * кошельками ваших детей».
 *
 * НЕТ на экране: Ring/RingSegmented, фильтров, поиска, tooltip'ов,
 * кружков/категорий (Обучение/Питание/Форма/Экскурсия — это BILLS,
 * не переводы). Литералы «ОТКУДА»/«КУДА»/«СУММА ПЕРЕВОДА» — не через t.*
 * (в макете строки 1770/1777/1784 забиты дословно).
 *
 * 15.08.2026 (оплаты). Сверху — плашка «это пример». Кнопка «Перевести»
 * раньше МЕНЯЛА балансы в памяти экрана и закрывала его — родитель видел
 * «перевод выполнен», хотя не происходило ничего. Теперь она объясняет,
 * почему перевода нет. Пресеты — из data/demoPayments.ts.
 */
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  Avatar,
  BottomSheetFrame,
  ChildPickerSheetContent,
  GlassCircleButton,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildren,
  getWalletBalance,
} from "../../data";
import type { ChildRow } from "../../data/types";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { DemoBanner, SoonNote } from "./parts";
import { TRANSFER_PRESETS } from "../../data/demoPayments";
import { formatMoney } from "../../lib/format";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── Локальные атомы ─────────────────────────────────────────────────────── */

/** Свап-стрелки 16px (макет 1776, path'ы дословно). */
function SwapIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m17 4 4 4-4 4" />
      <Path d="M3 8h18" />
      <Path d="m7 20-4-4 4-4" />
      <Path d="M21 16H3" />
    </Svg>
  );
}

/** Refresh-ccw-dot 15px белый для CTA (макет 1792, path'ы дословно). */
function TransferCtaIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m17 2 4 4-4 4" />
      <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <Path d="m7 22-4-4 4-4" />
      <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Svg>
  );
}

/** Иконка «zap» 17px для info-баннера (макет 1794, path дословно).
 *  ВАЖНО: это НЕ lightning-bolt (у lucide-react-native другой path);
 *  берём ровно тот, что в макете: 'm13 2-2 9h6l-8 11 2-9H5l8-11Z'. */
function ZapIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m13 2-2 9h6l-8 11 2-9H5l8-11Z" />
    </Svg>
  );
}

/** Одна карточка «кошелёк ребёнка» (FROM / TO). */
function WalletCard({
  child,
  balance,
  onPress,
}: {
  child: ChildRow | null;
  balance: number | null;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  const g = gradPoints(160);

  const inner = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingVertical: 11,
          paddingHorizontal: 13,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
        },
      ]}
    >
      {/* glass-1 линейный фон 160° (макет 1771/1778). */}
      <LinearGradient
        colors={tokens.glass1.colors as [string, string]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      {/* inset-блик 1.5px сверху (макет: inset 0 1.5 0 W95). */}
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
      {child ? (
        <>
          {/* Кольца аватара выступают наружу — компенсируем зазором. */}
          <View style={{ margin: 4.5 }}>
            <Avatar
              initials={child.first_name.slice(0, 1)}
              gradient={child.avatar_gradient}
              ringColor={child.avatar_ring}
              size={42}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
            >
              {child.full_name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.manrope700, fontSize: 10, color: "rgba(26,19,74,0.62)" }}
            >
              {child.class_name} класс
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}
          >
            {formatMoney(balance ?? 0)} сум
          </Text>
        </>
      ) : (
        // Кейс: только один ребёнок в семье — TO пуст. Осмысленный fallback.
        <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink3 }}>
          Нет второго кошелька
        </Text>
      )}
    </View>
  );

  // Тень 0 12 28 rgba(99,86,214,.13) на внешнем слое (иначе overflow срежет).
  const outer = [
    shadowStyle({ x: 0, y: 12, blur: 28, color: "rgba(99,86,214,0.13)" }),
    { borderRadius: 18 },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...outer, pressed ? { opacity: 0.9 } : null]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={outer}>{inner}</View>;
}

/** Быстрый чип суммы. selected — фиолетовый градиент; иначе — прозрачно-фиолетовый. */
function AmountChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const g = gradPoints(135);
  if (selected) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(124,58,237,0.35)" }),
          { borderRadius: 999 },
          pressed ? { opacity: 0.9 } : null,
        ]}
      >
        <LinearGradient
          colors={["#7C3AED", "#4F6DF5"]}
          start={g.start}
          end={g.end}
          style={{
            paddingVertical: 7,
            paddingHorizontal: 11,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#FFFFFF" }}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 7,
          paddingHorizontal: 11,
          borderRadius: 999,
          backgroundColor: "rgba(139,92,246,0.12)",
          borderWidth: 1,
          borderColor: "rgba(139,92,246,0.35)",
        },
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#6D28D9" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Экран ───────────────────────────────────────────────────────────────── */

export default function TransferScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const session = useAuthSession();
  const g = gradPoints(135);

  // Семейный список детей.
  const kids: ChildRow[] = getChildren();

  // Локальные балансы (в проде мутация уходит в БД; здесь — session-scoped).
  // 23.08.2026: сеттер убран — балансы больше не мутируются, перевод не
  // изображается, а объясняется (см. handleTransfer ниже).
  const [balances] = useState<Record<string, number>>(() =>
    Object.fromEntries(kids.map((k) => [k.id, getWalletBalance(k.id)])),
  );

  // FROM: currentChildId сессии, если он в семье, иначе первый ребёнок.
  const initialFromId =
    kids.find((k) => k.id === session.currentChildId)?.id ?? kids[0]?.id ?? "";
  // TO: первый другой ребёнок семьи (или null, если детей ≤ 1).
  const initialToId = kids.find((k) => k.id !== initialFromId)?.id ?? null;

  const [fromId, setFromId] = useState<string>(initialFromId);
  const [toId, setToId] = useState<string | null>(initialToId);
  const [valStr, setValStr] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const fromChild = kids.find((k) => k.id === fromId) ?? kids[0] ?? null;
  const toChild = toId ? kids.find((k) => k.id === toId) ?? null : null;
  const fromBalance = fromChild ? balances[fromChild.id] ?? 0 : 0;
  const toBalance = toChild ? balances[toChild.id] ?? 0 : 0;

  const valNum = Number(valStr) || 0;
  const enoughFunds = valNum > 0 && valNum <= fromBalance;

  // Только цифры, максимум 8 символов (макет 4147: .replace(/\D/g,'').slice(0,8)).
  const handleInput = (raw: string) => {
    setValStr(raw.replace(/\D/g, "").slice(0, 8));
  };

  // Свап FROM ↔ TO (макет 4146). Если TO пуст (1 ребёнок) — no-op.
  const handleSwap = () => {
    if (!toChild) return;
    const oldFrom = fromId;
    const oldTo = toChild.id;
    setFromId(oldTo);
    setToId(oldFrom);
  };

  // Выбор нового FROM из шторки. Если id === TO — reassign TO на другого.
  const handlePickFrom = (id: string) => {
    setSheetOpen(false);
    if (id === fromId) return;
    if (id === toId) {
      // Меняем TO на прежний FROM (это по духу swap; не оставляем перевод сам себе).
      setToId(fromId);
    }
    setFromId(id);
  };

  // Перевод упирается в отсутствующую платёжную систему. Раньше кнопка
  // МЕНЯЛА балансы в памяти экрана и закрывала его — родитель видел «перевод
  // выполнен», хотя не произошло ничего и после перезапуска деньги
  // возвращались. Теперь кнопка объясняет, почему перевода нет.
  const [soon, setSoon] = useState(false);
  const handleTransfer = () => {
    if (!enoughFunds || !toChild) return;
    setSoon((v) => !v);
  };

  // Пресеты трансфера [10000, 25000, 50000, null] — «Всё» = весь баланс FROM.
  const transferFx = {
    presets: TRANSFER_PRESETS,
    insufficient_text: d.parentApp.more3.transferNotEnough,
  };

  // Данные для шторки выбора источника (переиспользуем компонент из UI-кита).
  const pickerItems: ChildPickerItem[] = kids.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${t.grades.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  // Стили CTA (макет 4159). enabled — градиент + тень; disabled — pointerEvents:none.
  const ctaLabel = valNum > 0 ? `Перевести ${formatMoney(valNum)} сум` : "Перевести";

  return (
    <AppBackground>
      {/* Блок 1: Header row (padding 46/18/8, gap 12; Unbounded 14/600). */}
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
        <GlassCircleButton onPress={() => navigation.goBack()}>
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
            fontSize: 14,
            color: tokens.ink1,
          }}
        >
          {t.scr.transfer}
        </Text>
      </View>

      {/* Блок 2: Scroll container. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 4,
          paddingHorizontal: 18,
          paddingBottom: 118,
          gap: 10,
        }}
      >
        <DemoBanner text={d.parentApp.pay2.demoBanner} />

        {/* Блок 3: Caption ОТКУДА. Литерал (не через t.*, макет 1770). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            color: "rgba(26,19,74,0.5)",
          }}
        >
          ОТКУДА
        </Text>

        {/* Блок 4: FROM card — кликабельна. */}
        <WalletCard
          child={fromChild}
          balance={fromBalance}
          onPress={kids.length > 1 ? () => setSheetOpen(true) : undefined}
        />

        {/* Блок 5: Swap button — фиолетовый градиент 38×38. */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Pressable
            onPress={handleSwap}
            disabled={!toChild}
            style={({ pressed }) => [
              shadowStyle({ x: 0, y: 8, blur: 20, color: "rgba(124,58,237,0.4)" }),
              { borderRadius: 19 },
              pressed ? { opacity: 0.9 } : null,
              !toChild ? { opacity: 0.5 } : null,
            ]}
          >
            <LinearGradient
              colors={["#7C3AED", "#4F6DF5"]}
              start={g.start}
              end={g.end}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SwapIcon />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Блок 6: Caption КУДА. Литерал (макет 1777). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            color: "rgba(26,19,74,0.5)",
          }}
        >
          КУДА
        </Text>

        {/* Блок 7: TO card — НЕ кликабельна (осознанная асимметрия макета). */}
        <WalletCard child={toChild} balance={toChild ? toBalance : null} />

        {/* Блок 8: Amount card (padding 14, gap 8). */}
        <View
          style={[
            {
              padding: 14,
              borderRadius: 20,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: tokens.glassBorder,
            },
            shadowStyle({ x: 0, y: 14, blur: 34, color: "rgba(99,86,214,0.15)" }),
          ]}
        >
          {/* glass-1 фон 160°. */}
          <LinearGradient
            colors={tokens.glass1.colors as [string, string]}
            start={gradPoints(160).start}
            end={gradPoints(160).end}
            style={StyleSheet.absoluteFill}
          />
          {/* inset-блик. */}
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

          <View style={{ gap: 8 }}>
            {/* 8a. Caption «СУММА ПЕРЕВОДА» (литерал, макет 1784). */}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9.5,
                letterSpacing: 9.5 * 0.06,
                color: "rgba(26,19,74,0.5)",
              }}
            >
              СУММА ПЕРЕВОДА
            </Text>

            {/* 8b. Input-строка (border-bottom 2px rgba(124,58,237,.35), макет 1785). */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 4,
                paddingHorizontal: 2,
                borderBottomWidth: 2,
                borderBottomColor: "rgba(124,58,237,0.35)",
              }}
            >
              <TextInput
                value={valStr}
                onChangeText={handleInput}
                placeholder="0"
                placeholderTextColor="rgba(23,18,67,0.35)"
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={8}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: fonts.unbounded600,
                  fontSize: 24,
                  color: tokens.ink1,
                  padding: 0,
                }}
              />
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 13, color: "rgba(26,19,74,0.55)" }}>
                сум
              </Text>
            </View>

            {/* 8c. Строка доступности: красный при недостаточности (макет 4148–4149). */}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10,
                color: valNum > fromBalance ? "#B91C1C" : "rgba(26,19,74,0.6)",
              }}
            >
              {valNum > fromBalance
                ? transferFx.insufficient_text
                : `Доступно: ${formatMoney(fromBalance)} сум`}
            </Text>

            {/* 8d. Чипы быстрых сумм (макет 4150–4157). null = «Всё» → весь баланс. */}
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {transferFx.presets.map((preset, i) => {
                const value = preset === null ? fromBalance : preset;
                const label = preset === null ? "Всё" : formatMoney(preset);
                const selected = valStr === String(value);
                return (
                  <AmountChip
                    key={i}
                    label={label}
                    selected={selected}
                    onPress={() => setValStr(String(value))}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* Блок 9: CTA «Перевести {sum}» — динамический стиль. */}
        {enoughFunds ? (
          <Pressable
            onPress={handleTransfer}
            style={({ pressed }) => [
              shadowStyle({ x: 0, y: 14, blur: 32, color: "rgba(124,58,237,0.4)" }),
              { borderRadius: 16 },
              pressed ? { opacity: 0.92 } : null,
            ]}
          >
            <LinearGradient
              colors={["#7C3AED", "#4F6DF5"]}
              start={g.start}
              end={g.end}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 15,
                borderRadius: 16,
              }}
            >
              <TransferCtaIcon />
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: "#FFFFFF" }}>
                {ctaLabel}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 15,
              borderRadius: 16,
              backgroundColor: "rgba(23,18,67,0.08)",
            }}
          >
            {/* Иконка тем же цветом, что и текст (макет: color 'rgba(26,19,74,.4)'). */}
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="rgba(26,19,74,0.4)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m17 2 4 4-4 4" />
              <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <Path d="m7 22-4-4 4-4" />
              <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </Svg>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: "rgba(26,19,74,0.4)" }}>
              {ctaLabel}
            </Text>
          </View>
        )}
        {soon ? <SoonNote text={d.parentApp.pay2.soon} /> : null}

        {/* Блок 10: Info banner (зелёный, макет 1793–1795). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(16,185,129,0.1)",
            borderWidth: 1,
            borderColor: "rgba(16,185,129,0.3)",
          }}
        >
          <ZapIcon />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: "rgba(26,19,74,0.7)",
            }}
          >
            Перевод мгновенный и без комиссии. Переводить можно только между кошельками ваших детей.
          </Text>
        </View>
      </ScrollView>

      {/* Шторка выбора ребёнка-источника. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={fromId}
          onSelect={handlePickFrom}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}
