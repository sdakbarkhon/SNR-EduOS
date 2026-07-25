/**
 * Экран №19 «Checkout» (CheckoutScreen) — заход 6 редизайна v2.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 940–968
 * (сверху вниз):
 *   1. Header row 46/18/8 — glass-back + заголовок «Способ оплаты» + текст-
 *      ссылка «Отменить» (красный).
 *   2. Scroll container flex:1, gap 12, padding 4/18/118/18.
 *   3. OrderSummaryCard — glass r20: строка «К оплате» + сумма; список выбранных
 *      счетов; кликабельная ссылка «Показать/Скрыть детали» с разворачивающейся
 *      детализацией (только Обучение + Питание, других счетов в корзине нет).
 *   4. Section caption «ВЫБЕРИТЕ СПОСОБ ОПЛАТЫ».
 *   5. Список 5 payOpts (Payme/Click/Card/Uzum/QR) — рад-строки:
 *      radio + colored plate + name/chip/subtitle. Активная опция подсвечена
 *      violet-заливкой и накладкой border; неактивные — glass-1.
 *   6. Primary CTA «Оплатить {sum}» — accent-градиент 135° #7c3aed→#4f6df5,
 *      r16 p15, иконка замок 16, box-shadow violet.
 *   7. SecurityNotice — мягкая зелёная карточка с иконкой щита и фразой
 *      о защите платежа.
 *
 * Данные — из фикстур ДОСЛОВНО:
 *   - getDueBills() → 2 отмеченных счёта (Обучение · август, Питание · август);
 *   - getDueTotal() → 4 950 000 (единый источник, не хардкод);
 *   - getPayMethods() → 5 методов + default_id 'payme'.
 * Никаких кружков — в корзине только 4 возможных счёта (edu/food/form/exc),
 * в реальном чекауте — только два первых (in_main_list && checked_by_default).
 *
 * Интерактив (реальный state):
 *   - detOpen: boolean — свернуть/раскрыть детализацию;
 *   - pmId: string — id выбранной опции оплаты (радио);
 *   - doPay — при валидном pmId возвращается на bills, симулируя проведение
 *     платежа (глобальной success-шторки в проекте пока нет — Заход 8);
 *     если pmId не выбран, CTA disabled (opacity 0.5, onPress noop).
 *
 * ТЗ / CLAUDE.md §6: экраны реалистичны, без hardcoded бизнес-чисел. Формат
 * сумм — utils/format.ts (NBSP-группы). i18n — d.parentApp.{scr,pay,common}
 * из shared-словаря; ключа «Отменить» специфично для checkout нет — берём
 * общий common.cancelAction («Отменить»). Тексты «Показать/Скрыть детали»
 * и «Оплатить» в v2-словарь пока не занесены — используем литералы (совпадают
 * с макетом 1:1); добавление ключей — отдельная правка shared-словаря.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, GlassCircleButton } from "../../ui";
import { getDueBills, getDueTotal, getPayMethods } from "../../data";
import type { PayMethodRow } from "../../data/types";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../utils/format";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** «счёт | счёта | счетов» — правила русского плюрала (макет строка 3776). */
function pluralBills(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "счёт";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "счёта";
  return "счетов";
}

/**
 * Одна строка выбора способа оплаты. В макете это отрисовано плоским JSX без
 * выделенного компонента; здесь выносим локально, чтобы вложенные стили не
 * замусоривали основной return.
 */
function PayOptionRow({
  method,
  selected,
  onPress,
}: {
  method: PayMethodRow;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const g = gradPoints(135);

  // st (макет 3945): выбран → сплошная violet-подложка + rgba-border + soft shadow;
  // невыбран — glass-1 с бордюром 1px и мягкой тенью. Для тёмной темы используем
  // тот же паттерн, но берём заливку из glass-токенов (иначе слишком светло).
  const selectedRowStyle = {
    backgroundColor:
      scheme === "dark" ? "rgba(139,92,246,0.20)" : "rgba(124,58,237,0.10)",
    borderWidth: 1.5,
    borderColor:
      scheme === "dark" ? "rgba(139,92,246,0.60)" : "rgba(124,58,237,0.50)",
  } as const;
  const idleRowStyle = {
    backgroundColor:
      scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.60)",
    borderWidth: 1,
    borderColor:
      scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.78)",
  } as const;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          padding: 12,
          paddingHorizontal: 13,
          borderRadius: 18,
        },
        selected ? selectedRowStyle : idleRowStyle,
        shadowStyle({
          x: 0,
          y: 10,
          blur: selected ? 24 : 20,
          color: selected
            ? "rgba(124,58,237,0.15)"
            : "rgba(99,86,214,0.10)",
        }),
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      {/* radio 20×20 — активный: violet-градиент + внутренняя точка 7 (макет 3946). */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: selected ? 1 : 1.5,
          borderColor: selected
            ? "rgba(255,255,255,0.4)"
            : scheme === "dark"
              ? "rgba(255,255,255,0.35)"
              : "rgba(23,18,67,0.30)",
          overflow: "hidden",
        }}
      >
        {selected ? (
          <>
            <LinearGradient
              colors={["#7c3aed", "#4f6df5"]}
              start={g.start}
              end={g.end}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: "#FFFFFF",
              }}
            />
          </>
        ) : null}
      </View>

      {/* plate 42×29 r8 — цветной прямоугольник с брендом (макет 3947). */}
      <View
        style={{
          width: 42,
          height: 29,
          borderRadius: 8,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <LinearGradient
          colors={method.gradient as [string, string]}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 7,
            letterSpacing: 7 * 0.04,
            color: "#FFFFFF",
          }}
        >
          {method.tag}
        </Text>
      </View>

      {/* Название + чип + подпись (макет 940–968 внутренний блок). */}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 12.5,
              color: tokens.ink1,
            }}
          >
            {method.name}
          </Text>
          {method.recommended ? (
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 7,
                borderRadius: 999,
                backgroundColor:
                  scheme === "dark"
                    ? "rgba(16,185,129,0.16)"
                    : "rgba(16,185,129,0.14)",
                borderWidth: 1,
                borderColor: "rgba(16,185,129,0.35)",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 8.5,
                  color: tokens.status.green.text,
                }}
              >
                Рекомендуем
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 10,
            color:
              scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.60)",
          }}
        >
          {method.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CheckoutScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const t = d.parentApp;

  // Данные — единый источник правды: getDueBills / getDueTotal (см. src/data).
  const dueBills = getDueBills().filter((b) => b.checked_by_default);
  const totalAmount = getDueTotal();
  const paySumTxt = formatMoney(totalAmount, { withCurrency: true });

  const { methods, default_id } = getPayMethods();
  const [pmId, setPmId] = useState<string>(default_id);
  const [detOpen, setDetOpen] = useState<boolean>(false);

  // Строки детализации: имя + отформатированная сумма (макет 3941).
  const payDetRows = useMemo(
    () => dueBills.map((b) => ({ name: b.title, sumTxt: formatMoney(b.amount, { withCurrency: true }) })),
    [dueBills],
  );

  // Счётчик и список имён — как в макете 3937/3938.
  const payCountLabel = `${dueBills.length} ${pluralBills(dueBills.length)}`;
  const payNames = dueBills.map((b) => b.title).join(", ");
  const detLabel = detOpen ? "Скрыть детали ⌃" : "Показать детали ⌄";

  // Валидность CTA: должна быть сумма > 0 И выбран способ. Если поля метода
  // требуют ввода данных (например, «Банковская карта» → номер/CVV) — в проде
  // мы бы шли в отдельный экран платёжного провайдера, поэтому здесь считаем,
  // что выбор метода достаточен для активации CTA.
  const canPay = totalAmount > 0 && !!pmId;

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  // Возврат на список счетов — в проде здесь откроется success-шторка (Заход 8).
  const doPay = () => {
    if (!canPay) return;
    goBack();
  };

  // Мета-цвета (аналогично HomeworkDetailScreen).
  const captionColor = scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.50)";
  const softInk = scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.62)";
  const detailLabelColor = scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.70)";
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.07)";
  const violet = tokens.status.violet;

  return (
    <AppBackground>
      {/* 1. Header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
          flexShrink: 0,
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
          }}
        >
          {t.scr.payMethod}
        </Text>
        <Pressable onPress={goBack} hitSlop={8}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: tokens.status.red.text,
            }}
          >
            {t.common.cancelAction}
          </Text>
        </Pressable>
      </View>

      {/* 2. Scroll container */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. OrderSummaryCard */}
        <GlassCard radius={20} contentStyle={{ padding: 13, paddingHorizontal: 14, gap: 6 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 11,
                color: softInk,
              }}
            >
              К оплате
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 16,
                color: tokens.ink1,
              }}
            >
              {paySumTxt}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 10.5,
              color: softInk,
            }}
          >
            {payCountLabel}: {payNames}
          </Text>
          <Pressable onPress={() => setDetOpen((v) => !v)} hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11,
                color: violet.text,
              }}
            >
              {detLabel}
            </Text>
          </Pressable>
          {detOpen ? (
            <View
              style={{
                gap: 5,
                paddingTop: 7,
                borderTopWidth: 1,
                borderTopColor: dividerColor,
              }}
            >
              {payDetRows.map((row) => (
                <View
                  key={row.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope700,
                      fontSize: 10.5,
                      color: detailLabelColor,
                    }}
                  >
                    {row.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 10.5,
                      color: tokens.ink1,
                    }}
                  >
                    {row.sumTxt}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        {/* 4. Section caption */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: captionColor,
          }}
        >
          {t.pay.chooseMethod}
        </Text>

        {/* 5. Payment method options */}
        {methods.map((m) => (
          <PayOptionRow
            key={m.id}
            method={m}
            selected={pmId === m.id}
            onPress={() => setPmId(m.id)}
          />
        ))}

        {/* 6. Primary CTA «Оплатить {sum}» — violet-градиент 135° */}
        <Pressable
          onPress={doPay}
          disabled={!canPay}
          style={({ pressed }) => [
            shadowStyle({ x: 0, y: 14, blur: 32, color: "rgba(124,58,237,0.40)" }),
            { borderRadius: 16 },
            !canPay ? { opacity: 0.5 } : null,
            pressed && canPay ? { opacity: 0.9 } : null,
          ]}
        >
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            {...gradPoints(135)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 15,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {/* Иконка замка — rect 4/11 16×10 rx3 + дуга дужки (макет 961). */}
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Rect x={4} y={11} width={16} height={10} rx={3} />
              <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </Svg>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 14,
                color: "#FFFFFF",
              }}
            >
              Оплатить {paySumTxt}
            </Text>
            {/* inset-блик W35 */}
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
          </LinearGradient>
        </Pressable>

        {/* 7. SecurityNotice — мягкая зелёная карточка (макет 963–966). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor:
              scheme === "dark" ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.10)",
            borderWidth: 1,
            borderColor: "rgba(16,185,129,0.30)",
          }}
        >
          <Svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.status.green.text}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
            <Path d="m9 12 2 2 4-4" />
          </Svg>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.70)",
            }}
          >
            Платёж защищён. Все транзакции проходят через сертифицированные
            платёжные системы Узбекистана — данные карт в приложении не хранятся.
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}
