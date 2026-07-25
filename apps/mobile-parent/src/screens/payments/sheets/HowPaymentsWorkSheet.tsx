/**
 * HowPaymentsWorkSheet — bottom-sheet «Как работают оплаты» (FAQ) из макета
 * «SNR EduOS v2 Light.dc.html», строки 2521–2532 (helpPanel).
 *
 * Полный block-list (сверху вниз, порядок 1:1 из макета):
 *   1. Grabber handle              — предоставляет BottomSheetFrame (showGrip)
 *   2. Sheet title                 — «Как работают оплаты» 14/800 ink1
 *   3. Scrollable FAQ container    — ScrollView flex:1, paddingHorizontal 20
 *   4. FAQ accordion list          — 5 строк, border-bottom rgba(23,18,67,.07)
 *   5. FAQ row · question header   — Pressable row: label 12/800 ink1 + chevron
 *   6. FAQ row · answer body       — Text 11/600 ink2, скрыт по default
 *   7. Footer link row             — «Не нашли ответ? · Написать в бухгалтерию»
 *
 * Реальный интерактив:
 *   • openIndex (useState<number|null>): один аккордеон в момент времени;
 *   • шеврон вращается через transform: rotate(180deg) при раскрытии;
 *   • тело показывается mount/unmount (нативной анимации макет не диктует).
 *
 * FAQ-контент захардкожен в файле на русском (мокап тоже RU, а в
 * packages/core/src/i18n/*.ts ключей для этого FAQ пока не заведено —
 * контент не входит в объём z6 REBUILD; заводим при первом расширении
 * i18n-справочника, чтобы не разбегались 3 языка на этапе прототипа).
 */

import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { BottomSheetFrame } from "../../../ui";
import { fonts, useTheme } from "../../../theme";

export interface HowPaymentsWorkSheetProps {
  visible: boolean;
  onClose(): void;
  /** Клик по «Написать в бухгалтерию» — навигация в чат/раздел бухгалтерии. */
  onWriteToAccounting?(): void;
}

interface FaqItem {
  q: string;
  a: string;
}

// helpRows из макета: hint-placeholder-count="5". Контент — редакторский, не
// из фикстур (это справочная секция, а не финансовые данные).
const FAQ: readonly FaqItem[] = [
  {
    q: "Когда деньги списываются со счёта?",
    a: "Списание проходит сразу после подтверждения оплаты в приложении. Чек появляется в разделе «Счета и чеки» в течение нескольких минут.",
  },
  {
    q: "Какие способы оплаты доступны?",
    a: "Банковские карты Uzcard и Humo, Payme, Click и Apple Pay. Все платежи защищены протоколом 3-D Secure и подтверждаются одноразовым кодом.",
  },
  {
    q: "Можно ли отменить или вернуть платёж?",
    a: "После списания отмена возможна только через бухгалтерию школы. Обратитесь в течение 24 часов и приложите квитанцию — возврат придёт на ту же карту в срок до 5 рабочих дней.",
  },
  {
    q: "Как работает автоплатёж?",
    a: "Автоматическое списание за обучение и питание в первый рабочий день месяца. Мы уведомим вас за сутки до списания. Отключить автоплатёж можно в любой момент в настройках раздела «Оплаты».",
  },
  {
    q: "Где взять квитанцию для налогового вычета?",
    a: "Откройте раздел «Счета и чеки», выберите нужный платёж и нажмите «Скачать чек». Документ подписан ЭЦП школы и принимается налоговыми органами Республики Узбекистан.",
  },
] as const;

/** SVG-шеврон 14×14 — линии из макета m6 9 6 6 6-6, stroke-width 2.4. */
function ChevronDown({ color, open }: { color: string; open: boolean }) {
  return (
    <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
          d="m6 9 6 6 6-6"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export function HowPaymentsWorkSheet({
  visible,
  onClose,
  onWriteToAccounting,
}: HowPaymentsWorkSheetProps) {
  const { tokens, scheme } = useTheme();
  const dark = scheme === "dark";

  // Реальный интерактив: индекс раскрытой строки. null = все свёрнуты.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // border-bottom rgba(23,18,67,.07) из макета — в тёмной теме адаптируем
  // до 12% белого (тот же принцип, что в остальных hairline-разделителях).
  const rowBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(23,18,67,0.07)";
  const chevronColor = dark ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)";
  const footerLabelColor = dark ? "rgba(255,255,255,0.6)" : "rgba(26,19,74,0.6)";
  // Активная ссылка «Написать в бухгалтерию» — фирменный #6d28d9, в тёмной
  // теме используем tokens.accent (той же гаммы, но контрастнее на тёмном).
  const linkColor = dark ? tokens.accent : "#6D28D9";

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <BottomSheetFrame
      visible={visible}
      onClose={onClose}
      // Ограничим высоту: список FAQ + футер должны иметь запас, но не
      // заезжать под шапку экрана. 78% высоты — компромисс, макет явную
      // maxHeight не задаёт (использует flex:1 внутри auto-height панели).
      panelStyle={{ maxHeight: "82%" }}
    >
      {/* 2. Sheet title — 14/800, padding 2/20/8, flex-shrink:0 из макета. */}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: tokens.ink1,
          paddingHorizontal: 20,
          paddingTop: 2,
          paddingBottom: 8,
        }}
      >
        Как работают оплаты
      </Text>

      {/* 3. Scrollable FAQ container — flex:1, min-height:0, padding 0 20. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 4. FAQ accordion list — sc-for helpRows, 5 строк с border-bottom. */}
        {FAQ.map((item, index) => {
          const open = openIndex === index;
          return (
            <View
              key={item.q}
              style={{
                flexDirection: "column",
                borderBottomWidth: 1,
                borderBottomColor: rowBorder,
              }}
            >
              {/* 5. Question header — вся строка кликабельна. */}
              <Pressable
                onPress={() => toggle(index)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 12,
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={item.q}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.manrope800,
                    fontSize: 12,
                    color: tokens.ink1,
                  }}
                >
                  {item.q}
                </Text>
                <ChevronDown color={chevronColor} open={open} />
              </Pressable>

              {/* 6. Answer body — collapsible; макет использует display:none
                  для скрытия, у нас — условный рендер. */}
              {open ? (
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 11,
                    lineHeight: 17,
                    color: tokens.ink2,
                    paddingBottom: 12,
                  }}
                >
                  {item.a}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* 7. Footer link — «Не нашли ответ? · Написать в бухгалтерию». */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            paddingTop: 14,
            paddingBottom: 18,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11,
              color: footerLabelColor,
            }}
          >
            Не нашли ответ?
          </Text>
          <Pressable
            onPress={onWriteToAccounting}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Написать в бухгалтерию"
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11,
                color: linkColor,
              }}
            >
              Написать в бухгалтерию
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheetFrame>
  );
}

export default HowPaymentsWorkSheet;
