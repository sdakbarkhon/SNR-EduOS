/**
 * PaySuccessSheet — success-шторка успешной оплаты счетов «К оплате».
 * Спека: макет «SNR EduOS v2 Light.dc.html», строки 2489–2500
 * (paySheetOv → paySheetPanel; ветка `pay` из PAY_SHEET_TEXTS).
 *
 * Порядок блоков сверху вниз (Заход 6, block-by-block):
 *   1. Overlay (backdrop)     — даёт BottomSheetFrame. Клик НЕ закрывает
 *                                шторку (макет: у оверлея нет onClick) →
 *                                передаём onClose={undefined}.
 *   2. Sheet panel            — даёт BottomSheetFrame; drag-handle отключён
 *                                (showGrip={false}), header/close-иконки нет.
 *   3. Success icon           — 64×64 круг с зелёным градиентом + белая
 *                                galochka (SVG viewBox 24, path 'M20 6 9 17l-5-5',
 *                                stroke-width 2.6). Полностью статичный.
 *   4. Success title          — Unbounded 16/600 · ink1. Из пропа `title`.
 *   5. Success sum            — Unbounded 23/600 · ink1. Крупная сумма +
 *                                неразрывный пробел + валюта (t.sum).
 *   6. Success list           — Manrope 11/600 · ink2 (rgba(26,19,74,.62)),
 *                                text-align:center. Позиции соединяются « · ».
 *                                Допустимые позиции: Обучение, Питание,
 *                                Школьная форма, Экскурсия в музей.
 *   7. CTA «Готово»           — 100% ширина, padding 14, r15, 13.5/800/#fff,
 *                                accent-градиент 135° #7C3AED→#4F6DF5, тень
 *                                0 12 28 rgba(124,58,237,.4) + inset-hairline
 *                                W35. Всегда активна. Единственный путь закрыть.
 *
 * ВАЖНО:
 *  - В шторке НЕТ полей ввода / чекбоксов / радио / тумблеров — CTA всегда
 *    активна (disabled-состояния не бывает).
 *  - Overlay-тап и Android hardware back не закрывают шторку (строгое
 *    соответствие макету: у paySheetOv нет onClick, только стиль). Закрытие —
 *    только через CTA «Готово», которая дёргает onDone(). Все ветки родителя
 *    (Bills / Topup / Transfer / AddCard / Password) кроют шторку через тот же
 *    коллбек.
 *  - Данные — из state вызывающего экрана (сумма фактически оплаченных
 *    отмеченных счетов, список их названий). Здесь фикстуры не читаем —
 *    компонент презентационный.
 */
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { formatMoney } from "../../../utils/format";

/** Зелёный градиент success-иконки (макет строка 2494). */
const SUCCESS_GRAD: [string, string] = ["#34d399", "#059669"];
/** Тень зелёного круга — обе темы одинаково (макет 2494). */
const SUCCESS_SHADOW = { x: 0, y: 14, blur: 32, color: "rgba(5,150,105,0.4)" };
/** Inset-блик на круге и на CTA — W40 / W35 (макет 2494/2498). */
const SUCCESS_INSET_HAIRLINE = { height: 2, color: "rgba(255,255,255,0.4)" };
const CTA_INSET_HAIRLINE = { height: 1.5, color: "rgba(255,255,255,0.35)" };
/** CTA-градиент (accent 135° из макета 2498). Дублируем константой, а не
 *  тянем tokens.accentGrad — иначе тёмная тема даст другой стоп, а success
 *  CTA в макете фиксирован #7C3AED→#4F6DF5 в обеих схемах. */
const CTA_GRAD: [string, string] = ["#7c3aed", "#4f6df5"];
const CTA_SHADOW = { x: 0, y: 12, blur: 28, color: "rgba(124,58,237,0.4)" };

export interface PaySuccessSheetProps {
  /** Открыта ли шторка. Управляется родителем (paySheet !== null). */
  visible: boolean;
  /** Короткая надпись сверху (напр. «Платёж проведён»). Обычно —
   *  `t.pay.successBillTitle` или PAY_SHEET_TEXTS.pay.title. */
  title: string;
  /** Сумма в целых сумах — форматируется здесь через formatMoney (пробелы
   *  U+00A0 по 3 разряда) и рисуется крупным Unbounded 23/600. */
  amount: number;
  /**
   * Позиции оплаты — соединяются « · » и рисуются одной строкой (макет 2497).
   * Для основной ветки Bills — названия отмеченных счетов из BILLS: «Обучение»,
   * «Питание», «Школьная форма», «Экскурсия в музей». Кружков нет.
   */
  items: string[];
  /** Закрытие шторки. Срабатывает ТОЛЬКО из CTA «Готово» — overlay-тап и
   *  Android back здесь не привязаны (соответствие макету). */
  onDone(): void;
}

export function PaySuccessSheet({ visible, title, amount, items, onDone }: PaySuccessSheetProps) {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp.pay;
  const tCommon = d.parentApp.common;
  const grad135 = gradPoints(135);

  const sumText = formatMoney(amount, { withCurrency: true, currency: t.sum });
  const listText = items.join(" · ");

  return (
    // Блоки 1–2: overlay + панель. showGrip=false — нет drag-handle сверху.
    // onClose={undefined} — overlay-тап (и Android back) НЕ закрывают шторку;
    // единственный выход — CTA «Готово» ниже (соответствие макету 2491–2500).
    <BottomSheetFrame visible={visible} onClose={undefined} showGrip={false}>
      <View
        style={{
          paddingTop: 26,
          paddingHorizontal: 22,
          paddingBottom: 20,
          flexDirection: "column",
          alignItems: "center",
          // gap: 10 (макет 2493) — RN-Views поддерживают gap с 0.71/RN 0.71+.
          gap: 10,
        }}
      >
        {/* Блок 3: success-иконка. Круг 64×64 с зелёным градиентом, белой
            «галочкой» 30×30 и inset-бликом W40. Полностью статична. */}
        <View
          style={[
            {
              width: 64,
              height: 64,
              borderRadius: 32,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            },
            shadowStyle(SUCCESS_SHADOW),
          ]}
        >
          <LinearGradient
            colors={SUCCESS_GRAD}
            start={grad135.start}
            end={grad135.end}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          {/* inset-hairline W40 сверху (макет 2494). */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: SUCCESS_INSET_HAIRLINE.height,
              backgroundColor: SUCCESS_INSET_HAIRLINE.color,
            }}
          />
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6 L9 17 L4 12"
              stroke="#FFFFFF"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        {/* Блок 4: короткий заголовок (Unbounded 16/600). */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 16,
            color: tokens.ink1,
            textAlign: "center",
          }}
        >
          {title}
        </Text>

        {/* Блок 5: крупная сумма (Unbounded 23/600). */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 23,
            color: tokens.ink1,
            textAlign: "center",
          }}
        >
          {sumText}
        </Text>

        {/* Блок 6: перечень позиций одной строкой. */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11,
            lineHeight: 11 * 1.5,
            color: tokens.ink2,
            textAlign: "center",
          }}
        >
          {listText}
        </Text>

        {/* Блок 7: CTA «Готово» — единственный путь закрытия. Всегда активна. */}
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [
            {
              width: "100%",
              borderRadius: 15,
              marginTop: 4,
            },
            shadowStyle(CTA_SHADOW),
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          <LinearGradient
            colors={CTA_GRAD}
            start={grad135.start}
            end={grad135.end}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 13.5,
                color: "#FFFFFF",
              }}
            >
              {tCommon.done}
            </Text>
            {/* inset-hairline W35 сверху (макет 2498). */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: CTA_INSET_HAIRLINE.height,
                backgroundColor: CTA_INSET_HAIRLINE.color,
              }}
            />
          </LinearGradient>
        </Pressable>
      </View>
    </BottomSheetFrame>
  );
}

export default PaySuccessSheet;
