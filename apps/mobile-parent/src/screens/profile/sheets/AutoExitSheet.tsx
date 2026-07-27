/**
 * AutoExitSheet — Заход 7, block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 2461–2471 + вычисляемая логика
 * aeSheetOv/aeSheetPanel/aeOpts из state-блока строк 4227–4303.
 *
 * Порядок блоков (block-list):
 *  1  Overlay          — оверлей aeSheetOv (via BottomSheetFrame)
 *  2  Sheet panel      — панель aeSheetPanel (via BottomSheetFrame)
 *  3  Drag handle      — 44×5 r3 (via BottomSheetFrame, showGrip)
 *  4  Sheet title      — «Автоматический выход», 14/800 #171243
 *  5  Sheet subtitle   — «Выход из аккаунта при неактивности», 10/600 W60
 *  6  Options list     — sc-for по aeOpts (4 радио-строки):
 *                        строка + radio-индикатор с точкой активного
 *  7  Bottom spacer    — 16px внутренний отступ (после последней строки)
 *
 * Данные — только через фикстуры: getAutoExitFixture() возвращает
 * { options, default_value }. Мы держим 4 значения ('5' | '15' | '30' |
 * 'never') по позициям — параллельно options; порядок и длина фиксированы
 * фикстурой (константа as const, 4 элемента).
 *
 * Правила заказчика: специальных фильтров чата для этой шторки нет.
 * Оба theme-режима через useTheme() (tokens.ink1 / tokens.ink3 / accentGrad).
 * i18n: заголовок/подпись — литералы (в parentApp-словаре ключей нет; в мокапе
 * тоже литералы, строки 2465–2466). Тексты вариантов — из фикстуры.
 * iOS/Android safe-area рулится BottomSheetFrame (paddingBottom = insets.bottom).
 */
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints, useTheme } from "../../../theme";
import { BottomSheetFrame } from "../../../ui";
import { getAutoExitFixture } from "../../../data";

/** Значения автовыхода — жёстко соответствуют позициям AUTO_EXIT_OPTIONS
 *  (макет 4297): ['5', '15', '30', 'never']. */
export type AutoExitValue = "5" | "15" | "30" | "never";
const AUTO_EXIT_VALUES: readonly AutoExitValue[] = ["5", "15", "30", "never"] as const;

/** Заголовок/подпись — литералы макета (строки 2465–2466); parentApp-ключей нет. */
const SHEET_TITLE_RU = "Автоматический выход";
const SHEET_SUBTITLE_RU = "Выход из аккаунта при неактивности";

export interface AutoExitSheetProps {
  /** Открыта ли шторка. */
  visible: boolean;
  /** Тап по оверлею / грипу / выбору — родитель должен закрывать. */
  onClose: () => void;
  /** Текущее значение автовыхода. Если не задано — берём default_value фикстуры. */
  value?: AutoExitValue;
  /** Выбор варианта: (value) => void. Родитель сохраняет и вызывает onClose. */
  onPick?: (value: AutoExitValue) => void;
}

export function AutoExitSheet({
  visible,
  onClose,
  value,
  onPick,
}: AutoExitSheetProps) {
  const { tokens, scheme } = useTheme();
  const dark = scheme === "dark";

  const { options, default_value } = getAutoExitFixture();
  const selected: AutoExitValue = (value ?? (default_value as AutoExitValue)) as AutoExitValue;

  const gAcc = gradPoints(tokens.accentGrad.angle);

  // Разделитель между строками (макет 4299: borderTop: '1px solid rgba(23,18,67,.06)').
  const rowDivider = dark ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.06)";
  // Радио-обводка неактивного варианта (макет 4300: 1.5px rgba(23,18,67,.3)).
  const radioInactiveBorder = dark ? "rgba(255,255,255,0.30)" : "rgba(23,18,67,0.30)";
  // Внутренняя обводка активного варианта (макет 4300: 1px rgba(255,255,255,.4)).
  const radioActiveBorder = "rgba(255,255,255,0.4)";

  const handlePick = useCallback(
    (v: AutoExitValue) => {
      onPick?.(v);
      onClose();
    },
    [onPick, onClose],
  );

  return (
    <BottomSheetFrame visible={visible} onClose={onClose} showGrip>
      {/* 4. SheetTitle — 14/800 #171243, padding 2 20 0 (макет 2465). */}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: tokens.ink1,
          paddingHorizontal: 20,
          paddingTop: 2,
        }}
      >
        {SHEET_TITLE_RU}
      </Text>

      {/* 5. SheetSubtitle — 10/600 W60, padding 2 20 8 (макет 2466). */}
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 10,
          color: tokens.ink3,
          paddingHorizontal: 20,
          paddingTop: 2,
          paddingBottom: 8,
        }}
      >
        {SHEET_SUBTITLE_RU}
      </Text>

      {/* 6. OptionsList — 4 радио-строки (макет 2467–2469). */}
      {options.map((label, i) => {
        const v = AUTO_EXIT_VALUES[i];
        const isActive = v === selected;
        return (
          <Pressable
            key={v}
            onPress={() => handlePick(v)}
            style={({ pressed }) => [
              styles.row,
              {
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: rowDivider,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: tokens.ink1,
              }}
            >
              {label}
            </Text>
            {/* Radio-индикатор 20×20: активный — accentGrad + белая точка. */}
            <View
              style={[
                styles.radioOuter,
                isActive
                  ? {
                      borderWidth: 1,
                      borderColor: radioActiveBorder,
                      overflow: "hidden",
                    }
                  : {
                      borderWidth: 1.5,
                      borderColor: radioInactiveBorder,
                      backgroundColor: "transparent",
                    },
              ]}
            >
              {isActive ? (
                <>
                  <LinearGradient
                    colors={tokens.accentGrad.colors as [string, string, ...string[]]}
                    {...gAcc}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.radioDotActive} />
                </>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      {/* 7. Bottom spacer — 16px (макет 2470). */}
      <View style={{ height: 16 }} />
    </BottomSheetFrame>
  );
}

export default AutoExitSheet;

// ─── Стили ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  row: {
    // Макет 4299: display flex, align-items center, gap 11, padding 11 20.
    flexDirection: "row",
    alignItems: "center",
    columnGap: 11,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  radioOuter: {
    // Макет 4300: 20×20, круглый, flex-shrink 0, center.
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioDotActive: {
    // Макет 4301: 7×7 круг, белая заливка (активный).
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
  },
});
