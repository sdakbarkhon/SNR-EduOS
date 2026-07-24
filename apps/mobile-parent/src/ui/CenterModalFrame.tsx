/**
 * CenterModalFrame — каркас модалки-confirm (иконка-круг сверху, заголовок,
 * текст, кнопки — через props/children).
 * Спека: «SNR EduOS v2 Light.dc.html», conf*-оверлей:
 *  разметка строк 2481–2490: колонка по центру, gap 10, паддинг 24 22 18,
 *   иконка-круг 56×56 (фон/бордер в тоне действия), заголовок Unbounded 15/600,
 *   текст 11/600 rgba(26,19,74,.66) lh 1.55, далее кнопки на всю ширину;
 *  стили confOv/confPanel (строки 4026–4027): оверлей rgba(23,18,67,.38)+blur(4)
 *   opacity .28s; панель absolute left/right/bottom 8, r30, градиент 160°
 *   W92→W76, blur(26), border W90, тень 0 -16 50 rgba(64,54,150,.3) + inset W95,
 *   translateY(115%) → 0, .32s cubic-bezier(.2,.7,.3,1).
 *  NB: в макете confirm-панель прижата к низу (как шторка), не по центру
 *   экрана — переносим 1:1.
 * Тёмные пары — CSS-оверрайды макета: панель строки 38–42, border строка 61,
 *  тень строка 74, оверлей строка 124, текст строка 81 (.66 → W68).
 * Presentational: иконка/заголовок/текст/кнопки — только через props/children.
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { fonts, useTheme } from "../theme";
import { BottomSheetFrame } from "./BottomSheetFrame";

/** Вторичный текст confirm: светлая rgba(26,19,74,.66) (строка 2486); тёмная — CSS строка 81. */
const CONF_TEXT_LIGHT = "rgba(26,19,74,0.66)";
const CONF_TEXT_DARK = "rgba(255,255,255,0.68)";

export interface CenterModalFrameProps {
  visible: boolean;
  /** Тап по оверлею (отмена). */
  onClose?: () => void;
  /** Содержимое иконки-круга (svg-глиф). */
  icon?: ReactNode;
  /** Фон круга, напр. rgba(239,68,68,.12) (строка 2484). */
  iconBg?: string;
  /** Бордер круга, напр. rgba(239,68,68,.35) (строка 2484). */
  iconBorder?: string;
  title?: string;
  text?: string;
  /** Кнопки (на всю ширину, идут после текста). */
  children?: ReactNode;
}

export function CenterModalFrame({
  visible,
  onClose,
  icon,
  iconBg,
  iconBorder,
  title,
  text,
  children,
}: CenterModalFrameProps) {
  const { tokens, scheme } = useTheme();

  return (
    <BottomSheetFrame
      visible={visible}
      onClose={onClose}
      showGrip={false}
      overlayColorLight="rgba(23,18,67,0.38)" // confOv, строка 4026 (.38 против .35 у шторок)
    >
      <View
        style={{
          alignItems: "center",
          gap: 10,
          paddingTop: 24,
          paddingHorizontal: 22,
          paddingBottom: 18,
        }}
      >
        {icon ? (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: iconBg,
              borderWidth: iconBorder ? 1 : 0,
              borderColor: iconBorder,
            }}
          >
            {icon}
          </View>
        ) : null}
        {title ? (
          <Text
            style={{
              fontFamily: fonts.unbounded600,
              fontSize: 15,
              color: tokens.ink1,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
        ) : null}
        {text ? (
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11,
              lineHeight: 17, // 11 × 1.55 (строка 2486)
              color: scheme === "dark" ? CONF_TEXT_DARK : CONF_TEXT_LIGHT,
              textAlign: "center",
            }}
          >
            {text}
          </Text>
        ) : null}
        {children}
      </View>
    </BottomSheetFrame>
  );
}
