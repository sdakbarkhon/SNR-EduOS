/**
 * DatePickerSheet — Заход 5, block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 2501–2519 + вычисляемая логика
 * dsOv/dsPanel/dsCells/dsChips из state-блока строк 4626–4664.
 *
 * Порядок блоков (block-list):
 *  1  SheetOverlay          — оверлей dsOv (via BottomSheetFrame)
 *  2  SheetPanel            — панель dsPanel (via BottomSheetFrame)
 *  3  DragHandle            — 44×5 r3 rgba(23,18,67,.2) (via BottomSheetFrame)
 *  4  SheetTitle            — «Выберите дату», 14/800 #171243
 *  5  MonthNavRow           — space-between: prev · lbl · next
 *  6  MonthNavPrevButton    — 30×30 круглая glass, chevron-left
 *  7  MonthLabel            — «Июль 2026», 12.5/800 #171243
 *  8  MonthNavNextButton    — 30×30 круглая glass, chevron-right
 *  9  WeekdayHeaderRow      — Пн Вт Ср Чт Пт Сб Вс, 9/800, W36 центр
 *  10 CalendarGrid          — flex-wrap, justify space-between, row-gap 2
 *  11 QuickChipsRow         — gap 7, пресеты (Сегодня/Вчера/Начало недели)
 *  12 ActionsRow            — gap 8 между Reset/Apply
 *  13 ResetButton           — flex:1, glass W40 + бордер violet .45, #6d28d9
 *  14 ApplyButton           — flex:1.3, gradient accent 135°, тень violet
 *
 * Данные — только через фикстуры: getDatePickerMonths() и
 * getDatePickerQuickChips() (см. src/data/fixtures/schedule.ts).
 * Число ячеек — динамическое (5 или 6 недель, а не жёстко 35): пустые
 * cell-ы до 1-го числа рисуются как невидимые placeholder-ы 36×40, чтобы
 * justify-content:space-between корректно ровнял ряды.
 *
 * i18n: заголовок «Выберите дату» — литерал (в parentApp-словаре нет
 * этого ключа, в мокапе тоже литерал строка 2504). Тексты кнопок —
 * d.parentApp.common.reset/apply (block-list: t.commonReset/t.commonApply).
 *
 * Оба theme-режима через useTheme(): при dark ink/ink3/glass-фон
 * подставляются из tokens; акцентный градиент — tokens.accentGrad (в
 * тёмной теме это #8B5CF6→#3B82F6, макетный #7C3AED→#4F6DF5 сохраняется
 * в светлой). Тень выбранного дня — tokens.shColor(status.violet.rgb).
 * iOS safe-area рулится BottomSheetFrame и родителем (bottom:8 у панели).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { BottomSheetFrame } from "../../../ui";
import {
  DEMO_TODAY,
  getDatePickerMonths,
  getDatePickerQuickChips,
} from "../../../data";
import { useAppLocale } from "../../../i18n";

/** Ширины/высоты ячеек календаря — макет строка 4642 (36×40). */
const CELL_W = 36;
const CELL_H = 40;
/** Метки дней недели, порядок Пн→Вс — макет строка 2510. */
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
/** Заголовок шторки — литерал макета (parentApp-ключа нет). */
const SHEET_TITLE_RU = "Выберите дату";

export interface DatePickerSheetProps {
  /** Открыта ли шторка. */
  visible: boolean;
  /** Тап по оверлею / грипу / Reset+Apply — родитель должен закрывать. */
  onClose: () => void;
  /** Индекс месяца в DATE_PICKER_MONTHS (по умолчанию DEMO_TODAY.month_index). */
  initialMonthIndex?: number;
  /** Выбранный день 1..days (по умолчанию DEMO_TODAY.day). */
  initialDay?: number;
  /** Опциональный предикат «в этот день есть событие» — рисует точку под числом.
   *  Если не передан — точки не рисуем (в мокапе они были фейком по будням
   *  июля, здесь оставляем чисто визуальную возможность для родителя). */
  hasDot?: (monthIndex: number, day: number) => boolean;
  /** Нажата «Применить»: (monthIndex, day). Родитель сам решает, что делать. */
  onApply?: (monthIndex: number, day: number) => void;
  /** Нажата «Сбросить»: сбрасываем к DEMO_TODAY (месяц + день). */
  onReset?: () => void;
}

export function DatePickerSheet({
  visible,
  onClose,
  initialMonthIndex,
  initialDay,
  hasDot,
  onApply,
  onReset,
}: DatePickerSheetProps) {
  const { tokens, scheme } = useTheme();
  const dark = scheme === "dark";
  const { d } = useAppLocale();
  const tReset = d.parentApp.common.reset;
  const tApply = d.parentApp.common.apply;

  const months = getDatePickerMonths();
  const chips = getDatePickerQuickChips();

  const defaultMonth = initialMonthIndex ?? DEMO_TODAY.month_index;
  const defaultDay = initialDay ?? DEMO_TODAY.day;

  const [monthIdx, setMonthIdx] = useState<number>(defaultMonth);
  const [selDay, setSelDay] = useState<number>(defaultDay);

  // При каждом открытии — синхронизируем локальный state с пропсами.
  useEffect(() => {
    if (visible) {
      setMonthIdx(defaultMonth);
      setSelDay(defaultDay);
    }
    // deps без initial*, чтобы правки props посреди сессии не сбрасывали выбор
    // при уже открытой шторке.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const month = months[monthIdx];

  const handlePrev = useCallback(() => {
    setMonthIdx((i) => {
      if (i <= 0) return i;
      setSelDay(1); // макет строка 4630
      return i - 1;
    });
  }, []);
  const handleNext = useCallback(() => {
    setMonthIdx((i) => {
      if (i >= months.length - 1) return i;
      setSelDay(1); // макет строка 4631
      return i + 1;
    });
  }, [months.length]);

  const handleReset = useCallback(() => {
    // Reset макет-строка 4652: сброс к DEMO_TODAY.
    setMonthIdx(DEMO_TODAY.month_index);
    setSelDay(DEMO_TODAY.day);
    onReset?.();
    onClose();
  }, [onClose, onReset]);

  const handleApply = useCallback(() => {
    onApply?.(monthIdx, selDay);
    onClose();
  }, [monthIdx, selDay, onApply, onClose]);

  const gAcc = gradPoints(tokens.accentGrad.angle);
  const violetChip = tokens.chip(tokens.status.violet.rgb);
  const violetText = tokens.status.violet.text;
  const selShadow = tokens.shColor(tokens.status.violet.rgb);

  // ─── CalendarGrid: пустые placeholder-ы до 1-го + сами дни ────────────────
  interface Cell {
    key: string;
    day: number | null; // null — пустая ячейка-заполнитель
  }
  const cells: Cell[] = useMemo(() => {
    const out: Cell[] = [];
    for (let i = 0; i < month.offset; i++) out.push({ key: `p${i}`, day: null });
    for (let d0 = 1; d0 <= month.days; d0++) out.push({ key: `d${d0}`, day: d0 });
    // Добить до полного ряда, чтобы justify-content:space-between не растянул
    // последнюю неделю (7 → 7 колонок).
    while (out.length % 7 !== 0) out.push({ key: `t${out.length}`, day: null });
    return out;
  }, [month]);

  return (
    <BottomSheetFrame visible={visible} onClose={onClose} showGrip>
      {/* Внешний контейнер контента: padding 12/18/16, gap 9 (dsPanel, стр 4627). */}
      <View style={{ paddingTop: 12, paddingHorizontal: 18, paddingBottom: 16, rowGap: 9 }}>
        {/* 4. SheetTitle — 14/800, #171243 (макет 2504). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 14,
            color: tokens.ink1,
          }}
        >
          {SHEET_TITLE_RU}
        </Text>

        {/* 5. MonthNavRow — space-between. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* 6. MonthNavPrevButton — 30×30 glass, chevron-left (макет 2506). */}
          <Pressable
            onPress={handlePrev}
            disabled={monthIdx <= 0}
            hitSlop={6}
            style={({ pressed }) => [
              styles.navBtn,
              {
                backgroundColor: dark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(255,255,255,0.55)",
                borderColor: dark
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.8)",
                opacity: monthIdx <= 0 ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <ChevronIcon direction="left" color={tokens.ink1} />
          </Pressable>

          {/* 7. MonthLabel — 12.5/800 (макет 2507). */}
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 12.5,
              color: tokens.ink1,
            }}
          >
            {month.name}
          </Text>

          {/* 8. MonthNavNextButton — 30×30 glass, chevron-right (макет 2508). */}
          <Pressable
            onPress={handleNext}
            disabled={monthIdx >= months.length - 1}
            hitSlop={6}
            style={({ pressed }) => [
              styles.navBtn,
              {
                backgroundColor: dark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(255,255,255,0.55)",
                borderColor: dark
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.8)",
                opacity: monthIdx >= months.length - 1 ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <ChevronIcon direction="right" color={tokens.ink1} />
          </Pressable>
        </View>

        {/* 9. WeekdayHeaderRow — Пн→Вс (правила заказчика: 7-дневная лента). */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 2,
          }}
        >
          {WEEKDAYS_RU.map((w) => (
            <Text
              key={w}
              style={{
                width: CELL_W,
                textAlign: "center",
                fontFamily: fonts.manrope800,
                fontSize: 9,
                color: tokens.ink3,
              }}
            >
              {w}
            </Text>
          ))}
        </View>

        {/* 10. CalendarGrid — flex-wrap, justify-content:space-between, row-gap:2. */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 2,
          }}
        >
          {cells.map((c) => {
            if (c.day == null) {
              // Пустая ячейка (до 1-го / после последнего), не кликабельна.
              return <View key={c.key} style={{ width: CELL_W, height: CELL_H }} />;
            }
            const day = c.day;
            const w = (month.offset + day - 1) % 7; // 0=Пн … 6=Вс
            const isSelected = day === selDay;
            const isToday = day === DEMO_TODAY.day && monthIdx === DEMO_TODAY.month_index;
            const isWeekend = w > 4;
            const showDot = hasDot ? hasDot(monthIdx, day) : false;

            const cellStyle: ViewStyle = {
              width: CELL_W,
              height: CELL_H,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor:
                isToday && !isSelected ? tokens.accent : "transparent",
              // Тень выбранной ячейки — только при isSelected.
              ...(isSelected ? shadowStyle(selShadow) : null),
            };

            const textColor = isSelected
              ? "#FFFFFF"
              : isWeekend
              ? tokens.ink3
              : tokens.ink1;
            const textWeight = isSelected ? fonts.manrope800 : fonts.manrope700;

            const dotColor = isSelected ? "rgba(255,255,255,0.9)" : tokens.accent;

            return (
              <Pressable
                key={c.key}
                onPress={() => setSelDay(day)}
                style={cellStyle}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={tokens.accentGrad.colors as [string, string, ...string[]]}
                    {...gAcc}
                    style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                  />
                ) : null}
                <View style={{ alignItems: "center", justifyContent: "center", rowGap: 2 }}>
                  <Text
                    style={{
                      fontFamily: textWeight,
                      fontSize: 12,
                      color: textColor,
                      lineHeight: 14,
                    }}
                  >
                    {day}
                  </Text>
                  {/* Маркер-точка события под числом. */}
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: showDot ? dotColor : "transparent",
                    }}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 11. QuickChipsRow — пресеты; при нажатии — устанавливаем месяц+день. */}
        <View style={{ flexDirection: "row", columnGap: 7, flexWrap: "wrap", rowGap: 6 }}>
          {chips.map((c) => (
            <Pressable
              key={c.label}
              onPress={() => {
                setMonthIdx(c.month_index);
                setSelDay(c.day);
              }}
              style={({ pressed }) => ({
                paddingVertical: 6,
                paddingHorizontal: 11,
                borderRadius: 999,
                backgroundColor: violetChip.bg,
                borderWidth: 1,
                borderColor: violetChip.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10.5,
                  color: violetText,
                }}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 12. ActionsRow. */}
        <View style={{ flexDirection: "row", columnGap: 8 }}>
          {/* 13. ResetButton — flex:1, glass W40 + violet border (макет 2516). */}
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: dark
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.4)",
              borderWidth: 1.5,
              borderColor: `rgba(${tokens.status.violet.rgb},0.45)`,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: violetText,
              }}
            >
              {tReset}
            </Text>
          </Pressable>

          {/* 14. ApplyButton — flex:1.3, gradient 135° accent (макет 2517). */}
          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [
              {
                flex: 1.3,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 12,
                borderRadius: 14,
                overflow: "hidden",
                opacity: pressed ? 0.94 : 1,
              },
              shadowStyle({
                x: 0,
                y: 12,
                blur: 28,
                color: `rgba(${tokens.status.violet.rgb},0.4)`,
              }),
            ]}
          >
            <LinearGradient
              colors={tokens.accentGrad.colors as [string, string, ...string[]]}
              {...gAcc}
              style={StyleSheet.absoluteFill}
            />
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: "#FFFFFF",
              }}
            >
              {tApply}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetFrame>
  );
}

export default DatePickerSheet;

// ─── Вспомогательные ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});

function ChevronIcon({ direction, color }: { direction: "left" | "right"; color: string }) {
  const path = direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6";
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
