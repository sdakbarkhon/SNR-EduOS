/**
 * LessonRow — строка урока расписания, перенос 1:1 из макета
 * «SNR EduOS v2 Light.dc.html»:
 *   §s7 строка урока (строка 2773): колонка времени 44px (старт /800 + конец 9.5
 *   rgba(26,19,74,.5)), вертикальная полоса 3.5×34 r2 градиента предмета 180°,
 *   title 12.5/800, sub rgba(26,19,74,.6), чип «Идёт сейчас» оранжевой семьи;
 *   экран 15 «Расписание», schedRowsFor (строки 3526–3548): точка 9px с ореолом
 *   3px subj.bg в колонке времени, glass-карточка r18 padding 11 13,
 *   shadow 0 12px 28px rgba(99,86,214,.13), чип оценки со звёздочкой,
 *   строка темы 9.5/700 rgba(26,19,74,.48), пройденный урок opacity .82.
 * Тёмные пары — CSS-оверрайды: строки 64 (тень), 82 (.65 → W66), 85 (.6 → W62),
 * 87 (.5 → W55), 88 (.48 → W50).
 * Блюр: в макете у карточки backdrop-filter blur(22px) — через общий
 * glassSurface/GlassBlur (src/ui/glass.ts, единый флаг fallback).
 */
import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, fonts, gradPoints, shadowStyle } from "../theme";
import { GlassBlur, glassSurface } from "./glass";
import { StarRating } from "./StarRating";

/** Тень карточки урока: светлая — строка 3528; тёмная — CSS строка 64. */
const CARD_SHADOW = {
  light: { x: 0, y: 12, blur: 28, color: "rgba(99,86,214,0.13)" },
  dark: { x: 0, y: 12, blur: 32, color: "rgba(4,6,20,0.35)" },
};
/** Время неактивного урока rgba(26,19,74,.65): тёмная пара — CSS строка 82. */
const TIME_INACTIVE = { light: "rgba(26,19,74,0.65)", dark: "rgba(255,255,255,0.66)" };
/** Конец слота rgba(26,19,74,.5): тёмная пара — CSS строка 87. */
const TIME_END = { light: "rgba(26,19,74,0.5)", dark: "rgba(255,255,255,0.55)" };
/** Подпись rgba(26,19,74,.6): тёмная пара — CSS строка 85. */
const SUB = { light: "rgba(26,19,74,0.6)", dark: "rgba(255,255,255,0.62)" };
/** Тема урока rgba(26,19,74,.48): тёмная пара — CSS строка 88. */
const THEME_LINE = { light: "rgba(26,19,74,0.48)", dark: "rgba(255,255,255,0.5)" };

export interface LessonRowProps {
  /** Начало слота, 12/800 (строка 3540). */
  timeStart: string;
  /** Конец слота, 9.5 (строка 2773). */
  timeEnd?: string;
  /** Активный (текущий) урок — время цветом ink1, иначе .65 (строка 3540). */
  active?: boolean;
  /** Точка 9px в колонке времени; цвет — subj-база (строка 3541). */
  dotColor?: string;
  /** Ореол точки 3px — subj.bg (chip-фон предмета, строка 3541). */
  dotHalo?: string;
  /** Вертикальная полоса 3.5×34 r2 — градиент предмета 180° (строка 2773). */
  barGradient?: [string, string];
  /** Название урока 12.5/800. */
  title: string;
  /** Подпись «10:20 – 11:05 · Каб. 204 · …» 9.5/600 (строка 3545). */
  subtitle?: string;
  /** Строка «Тема: …» 9.5/700 (строка 3546). */
  themeLine?: string;
  /**
   * Чип оценки со звёздочкой (строка 3536): цвет текста + семья «R,G,B»
   * для chip-фона/бордера через tokens.chip().
   */
  grade?: { value: string; text: string; rgb: string };
  /** Чип «Идёт сейчас» (строка 3522): оранжевая статусная семья. */
  nowLabel?: string;
  /** Произвольный правый слот (взамен чипов). */
  right?: ReactNode;
  /** Пройденный урок: opacity .82 (строка 3542). */
  dimmed?: boolean;
  onPress?: () => void;
}

export function LessonRow({
  timeStart,
  timeEnd,
  active = false,
  dotColor,
  dotHalo,
  barGradient,
  title,
  subtitle,
  themeLine,
  grade,
  nowLabel,
  right,
  dimmed = false,
  onPress,
}: LessonRowProps) {
  const { tokens, scheme } = useTheme();
  const g = gradPoints(tokens.glass1.angle);
  const orange = tokens.status.orange;
  const orangeChip = tokens.chip(orange.rgb);
  const gradeChip = grade ? tokens.chip(grade.rgb) : null;

  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
      {/* Колонка времени 44px: старт + точка с ореолом (строки 642, 3540–3541). */}
      <View style={{ width: 44, alignItems: "center", gap: 4, paddingTop: 11 }}>
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 12,
            color: active ? tokens.ink1 : TIME_INACTIVE[scheme],
          }}
        >
          {timeStart}
        </Text>
        {timeEnd ? (
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 9.5,
              color: TIME_END[scheme],
            }}
          >
            {timeEnd}
          </Text>
        ) : null}
        {dotColor ? (
          // Точка 9px с ореолом 3px subj.bg: box-shadow 0 0 0 3px → внешний круг 15px.
          <View
            style={{
              width: 15,
              height: 15,
              borderRadius: 7.5,
              backgroundColor: dotHalo ?? "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 4.5,
                backgroundColor: dotColor,
              }}
            />
          </View>
        ) : null}
      </View>
      {/* Glass-карточка урока (строка 3528). */}
      <View
        style={[
          { flex: 1, minWidth: 0, borderRadius: 18, opacity: dimmed ? 0.82 : 1 },
          shadowStyle(CARD_SHADOW[scheme]),
        ]}
      >
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={{
            borderRadius: 18,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: tokens.glassBorder,
          }}
        >
          {(() => {
            // Общий glassSurface: blur по единому коэффициенту либо fallback-заливка.
            const surface = glassSurface(tokens.glass1, scheme);
            return surface.mode === "blur" ? (
              <>
                <GlassBlur
                  intensity={surface.intensity}
                  tint={surface.tint}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={[tokens.glass1.colors[0], tokens.glass1.colors[1]]}
                  start={g.start}
                  end={g.end}
                  style={StyleSheet.absoluteFill}
                />
              </>
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
            );
          })()}
          {/* inset-блик стекла → верхняя hairline-полоска (glassInset). */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: tokens.glassInset.y,
              backgroundColor: tokens.glassInset.color,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 11,
              paddingHorizontal: 13,
            }}
          >
            {barGradient ? (
              // Полоса 3.5×34 r2, градиент 180° (строка 2773).
              <LinearGradient
                colors={[barGradient[0], barGradient[1]]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ width: 3.5, height: 34, borderRadius: 2 }}
              />
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12.5,
                  color: tokens.ink1,
                }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: SUB[scheme],
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
              {themeLine ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 9.5,
                    color: THEME_LINE[scheme],
                  }}
                >
                  {themeLine}
                </Text>
              ) : null}
            </View>
            {right}
            {!right && grade && gradeChip ? (
              // Чип оценки со звёздочкой (строка 3536).
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  backgroundColor: gradeChip.bg,
                  borderWidth: 1,
                  borderColor: gradeChip.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 11,
                    color: grade.text,
                  }}
                >
                  {grade.value}
                </Text>
                <StarRating count={1} total={1} size={10} color={grade.text} />
              </View>
            ) : null}
            {!right && !grade && nowLabel ? (
              // Чип «Идёт сейчас» (строка 3522).
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: orangeChip.bg,
                  borderWidth: 1,
                  borderColor: orangeChip.border,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: `rgb(${orange.rgb})`,
                  }}
                />
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 9,
                    color: orange.text,
                  }}
                >
                  {nowLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
