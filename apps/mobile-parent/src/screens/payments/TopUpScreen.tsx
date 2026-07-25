/**
 * Экран «Пополнение баланса» (dtop) — Заход 6, REBUILD block-by-block.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1098–1130:
 *  1099–1102  TopBar: круглая glass-back-кнопка 38 (arrow-left 18 stroke 2)
 *             + Unbounded 15/600 заголовок «Пополнение баланса». Мы делегируем
 *             это InnerHeader — совпадает по спеке (см. InnerHeader.tsx).
 *  1103       ScrollArea: gap 12, padding 4/18/118 (учёт FloatingTabBar).
 *  1104–1108  WalletCard: glass r20 pad 12/14; слева initial-badge 38 круг
 *             (rgba(124,58,237,.12) + border rgba(124,58,237,.3), инициал
 *             12.5/800 #7c3aed); центр — walletTitle «Кошелёк {gen}» 12/800
 *             + «Текущий баланс» 10/600 rgba(26,19,74,.62); справа сумма
 *             баланса 13.5/800.
 *  1109–1118  AmountCard: glass r20 pad 16/14 gap 9; caption «СУММА
 *             ПОПОЛНЕНИЯ» 9.5/800 letter-spacing .06em; input Unbounded 26/600
 *             + суффикс «сум» 13/700, нижняя граница 2px #7c3aed .35; ряд из
 *             4 pill-чипов быстрых сумм (50 000 / 100 000 / 200 000 / 500 000
 *             — TOPUP_PRESETS из data/wallet).
 *  1119–1123  PaymentMethodRow: glass r20 pad 12/14; левый бейдж 40×28 r8
 *             mint-градиент с текстом «PAYME»; заголовок «Payme» + подпись
 *             «Мгновенное зачисление»; справа ссылка «Изменить» (#6d28d9)
 *             → goPaymeth (d33).
 *  1124       CTA: Pressable, динамический стиль topBtnStyle — при пустом
 *             topVal кнопка серая и не тапается (правило заказчика), при
 *             непустом — фиолетовый градиент 135° #7c3aed→#4f6df5 + shadow;
 *             плюс-иконка 16×16 stroke #fff 2.2 + лейбл topBtnLabel
 *             («Пополнить» / «Пополнить на {sum} сум»).
 *  1125–1128  InstantNoticeBanner: плашка rgba(16,185,129,.1) + border
 *             rgba(16,185,129,.3) r18 pad 12/14; иконка молнии 17×17 stroke
 *             #047857 2; текст 10/600 line-height 1.55 rgba(26,19,74,.7)
 *             «Зачисление мгновенное: …».
 *
 * Данные — через аксессоры src/data (getSelectedChildContext + getTopupPresets).
 * Тексты: t.parentApp.scr.topup / t.parentApp.pay.sum / walletTitle-шаблон
 * pay.walletTitle. Обе темы — useTheme(); iOS safe-area — из InnerHeader.
 *
 * ВАЖНО (block-list § extract):
 *  - Никаких кружков и позиций трат на этом экране НЕТ — только строка Payme
 *    как способ оплаты и информационная плашка про «столовую».
 *  - Ring/RingSegmented НЕТ. FAB / Search / Empty-state ОТСУТСТВУЮТ.
 *  - Способ оплаты фиксирован (Payme); смена — через ссылку goPaymeth.
 *  - При пустом поле CTA disabled (opacity + pointerEvents:none).
 *  - Экран не пишет в кошелёк — реальное списание/зачисление появится на этапе
 *    подключения платёжного провайдера (Payme). Сейчас doTopup — no-op.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, InnerHeader } from "../../ui";
import { getSelectedChildContext, getTopupPresets } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../lib/format";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── SVG-атомы (все размеры / stroke — дословно из макета) ──────────────── */

/** Плюс-иконка CTA (макет 1124): 16×16 stroke #fff 2.2. */
function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round">
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}

/** Молния info-banner (макет 1126): 17×17 stroke #047857 2. */
function BoltIcon() {
  return (
    <Svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#047857"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m13 2-2 9h6l-8 11 2-9H5l8-11Z" />
    </Svg>
  );
}

/* ─── Быстрый чип суммы (макет 1116, sc-for topChips) ────────────────────── */

interface QuickChipProps {
  amount: number;
  active: boolean;
  onPick: () => void;
}
function QuickAmountChip({ amount, active, onPick }: QuickChipProps) {
  // Активный: фиолетовый градиент 135° #7c3aed→#4f6df5, белый текст, glow;
  // неактивный: rgba(139,92,246,.12) + border rgba(139,92,246,.35), фиолет #6d28d9.
  const grad = gradPoints(135);
  const label = formatMoney(amount);

  return (
    <Pressable onPress={onPick}>
      <View
        style={[
          {
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: active ? 0 : 1,
            borderColor: "rgba(139,92,246,0.35)",
            backgroundColor: active ? "transparent" : "rgba(139,92,246,0.12)",
            overflow: "hidden",
          },
          active
            ? shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(124,58,237,0.35)" })
            : null,
        ]}
      >
        {active ? (
          <LinearGradient
            colors={["#7C3AED", "#4F6DF5"]}
            start={grad.start}
            end={grad.end}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 11,
            color: active ? "#FFFFFF" : "#6D28D9",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── Экран ───────────────────────────────────────────────────────────────── */

export default function TopUpScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const ctx = getSelectedChildContext(session.currentChildId ?? undefined);
  const child = ctx.child;
  const balance = ctx.wallet_balance;

  const presets = getTopupPresets();

  // Локальное состояние: строка цифр, до 9 знаков (макет 3973).
  const [topVal, setTopVal] = useState<string>("");

  const walletTitle = t.pay.walletTitle.replace("{gen}", child.first_name_gen);
  const walletBalTxt = `${formatMoney(balance)} ${t.pay.sum}`;
  const childInitial = child.first_name.slice(0, 1);

  const hasValue = topVal.length > 0 && Number(topVal) > 0;
  const topBtnLabel = hasValue
    ? `${t.pay.topupBtn} на ${formatMoney(Number(topVal))} ${t.pay.sum}`
    : t.pay.topupBtn;

  const handleInput = (raw: string) => {
    // Только цифры, максимум 9 (макет 3973).
    setTopVal(raw.replace(/\D/g, "").slice(0, 9));
  };

  const goPaymeth = () => navigation.navigate("d33");

  const doTopup = () => {
    // В проде — уход на страницу платёжного провайдера (Payme). Сейчас no-op:
    // экран не изменяет кошелёк без реальной транзакции.
    if (!hasValue) return;
    // TODO(payments): вызов Payme-checkout, затем возврат сюда с успешным
    // paySheet (см. paySheet={ kind:'top', sum } в макете 3981).
  };

  return (
    <AppBackground>
      {/* Блок 1: TopBar — InnerHeader (back-glass + Unbounded 15/600). */}
      <InnerHeader
        title={t.scr.topup}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
      />

      {/* Блок 2: ScrollArea. gap 12, padding 4/18/118. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* Блок 3: WalletCard — инициал ребёнка + заголовок кошелька + баланс. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(124,58,237,0.12)",
                borderWidth: 1,
                borderColor: "rgba(124,58,237,0.3)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#7C3AED" }}>
                {childInitial}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}
              >
                {walletTitle}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}>
                Текущий баланс
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: tokens.ink1 }}>
              {walletBalTxt}
            </Text>
          </View>
        </GlassCard>

        {/* Блок 4: AmountCard — caption + input + suffix + быстрые чипы. */}
        <GlassCard
          radius={20}
          contentStyle={{ paddingVertical: 16, paddingHorizontal: 14, gap: 9 }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 9.5,
              letterSpacing: 0.06 * 9.5,
              color: tokens.ink3,
            }}
          >
            {t.pay.topupChooseAmount.toUpperCase()}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 2,
              paddingVertical: 4,
              borderBottomWidth: 2,
              borderBottomColor: "rgba(124,58,237,0.35)",
            }}
          >
            <TextInput
              value={topVal}
              onChangeText={handleInput}
              placeholder={t.pay.topupInputPlaceholder}
              placeholderTextColor={tokens.ink3}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={9}
              style={{
                flex: 1,
                minWidth: 0,
                padding: 0,
                fontFamily: fonts.unbounded600,
                fontSize: 26,
                color: tokens.ink1,
              }}
            />
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 13, color: tokens.ink2 }}>
              {t.pay.sum}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {presets.map((p) => (
              <QuickAmountChip
                key={p}
                amount={p}
                active={topVal === String(p)}
                onPick={() => setTopVal(String(p))}
              />
            ))}
          </View>
        </GlassCard>

        {/* Блок 5: PaymentMethodRow — Payme + «Изменить». */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View
              style={{
                width: 40,
                height: 28,
                borderRadius: 8,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LinearGradient
                colors={["#2DD4BF", "#0D9488"]}
                {...gradPoints(135)}
                style={StyleSheet.absoluteFill}
              />
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 7,
                  letterSpacing: 0.04 * 7,
                  color: "#FFFFFF",
                }}
              >
                PAYME
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                Payme
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}>
                Мгновенное зачисление
              </Text>
            </View>
            <Pressable onPress={goPaymeth} hitSlop={8}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#6D28D9" }}>
                Изменить
              </Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* Блок 6: CTA — динамический topBtnStyle. */}
        <Pressable onPress={doTopup} disabled={!hasValue}>
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 15,
                paddingHorizontal: 15,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: hasValue ? "transparent" : "rgba(23,18,67,0.08)",
              },
              hasValue
                ? shadowStyle({ x: 0, y: 14, blur: 32, color: "rgba(124,58,237,0.4)" })
                : null,
            ]}
          >
            {hasValue ? (
              <LinearGradient
                colors={["#7C3AED", "#4F6DF5"]}
                {...gradPoints(135)}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {/* inset-highlight верхней хайлайт-полоски (макет 3980, inset 0 1.5 0 W35). */}
            {hasValue ? (
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
            ) : null}
            {hasValue ? <PlusIcon /> : null}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 14,
                color: hasValue ? "#FFFFFF" : "rgba(26,19,74,0.4)",
              }}
            >
              {topBtnLabel}
            </Text>
          </View>
        </Pressable>

        {/* Блок 7: InstantNoticeBanner — «Зачисление мгновенное …». */}
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
          <BoltIcon />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: "rgba(26,19,74,0.7)",
            }}
          >
            Зачисление мгновенное: деньги появятся на кошельке ребёнка сразу после
            оплаты и будут доступны в столовой уже на следующей перемене.
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}
