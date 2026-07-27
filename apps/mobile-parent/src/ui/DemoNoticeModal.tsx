/**
 * DemoNoticeModal — one-shot центр-модалка «Демо-режим».
 *
 * ЗАХОД 5x (правка 3): заменяет старый `DemoBannerGlass` (жёлтая полоса
 * поверх шапки). Показывается один раз сразу после успешного демо-входа
 * (isDemo=true && !demoNoticeSeen), при закрытии — переключает флаг до
 * конца сессии. На phone-flow не показывается вообще.
 *
 * Реализация:
 *  – каркас — `CenterModalFrame` (уже есть в UI-ките, тот же слой z-index,
 *    что и confirm-dialog «Выйти?»);
 *  – иконка-круг с треугольником «!» — жёлто-оранжевый градиент 135°,
 *    подобранный под тон предупреждения (аналог тона status.orange, но с
 *    более тёплым уклоном как у старого баннера);
 *  – одна кнопка «Понятно» — идёт через `PrimaryButton` (accent-градиент),
 *    т.к. это подтверждение, а не деструктивное действие.
 *
 * Тексты — `d.parentApp.demo.{title,body,cta}` (RU/UZ/EN, добавлены в
 * packages/core/src/i18n).
 */
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { fonts, gradPoints } from "../theme";
import { CenterModalFrame } from "./CenterModalFrame";
import { PrimaryButton } from "./PrimaryButton";

export interface DemoNoticeModalProps {
  visible: boolean;
  title: string;
  body: string;
  cta: string;
  onDismiss: () => void;
}

/** Жёлто-оранжевый градиент для иконки-круга «!». Тон подобран под старый
 *  DemoBannerGlass (255,240,138)/(202,138,4) — жёлтая семья макета
 *  строка 4273. Здесь берём чуть насыщеннее для узнаваемости на белом
 *  стекле модалки. */
const ICON_GRAD: [string, string] = ["#facc15", "#f97316"];

export function DemoNoticeModal({
  visible,
  title,
  body,
  cta,
  onDismiss,
}: DemoNoticeModalProps) {
  const g = gradPoints(135);
  return (
    <CenterModalFrame
      visible={visible}
      // onClose НЕ передаём — тап по оверлею НЕ закрывает модалку;
      // единственный способ закрыть — кнопка «Понятно» (заказчик, правка 3).
      icon={
        <LinearGradient
          colors={ICON_GRAD}
          start={g.start}
          end={g.end}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg
            width={26}
            height={26}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <Path d="M12 9v4" />
            <Path d="M12 17h.01" />
          </Svg>
        </LinearGradient>
      }
      title={title}
      text={body}
    >
      {/* Одна кнопка «Понятно» — accent-градиент, ширина всего блока. */}
      <View style={{ alignSelf: "stretch", marginTop: 6 }}>
        <PrimaryButton label={cta} onPress={onDismiss} />
      </View>
    </CenterModalFrame>
  );
}
