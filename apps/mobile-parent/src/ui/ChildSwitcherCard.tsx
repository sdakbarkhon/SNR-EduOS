/**
 * ChildSwitcherCard — карточка-переключатель ребёнка, перенос 1:1 из макета
 * «SNR EduOS v2 Light.dc.html»:
 *   П5 Dashboard (строки 228–229): glass r22, padding 12 14, аватар 50,
 *     ФИО 14.5/800, класс 11.5/700 rgba(26,19,74,.62) + шеврон-вниз 11,
 *     StatusChip «В школе» (10/800, дот 6, шеврон 10, тень 0 4 10 rgba(16,185,129,.18)),
 *     хвостовой шеврон 15 rgba(26,19,74,.4); низ — слот метрик (строки 230–240);
 *   П10/расписание compact (строки 281, 632): glass r18, padding 10 12, аватар 44,
 *     ФИО 13.5/800, класс 11/700, справа колонка: чип 9.5/800 (дот 5) +
 *     «Сменить ребёнка ›» 10.5/800 #6d28d9;
 *   компакт-эталон §s7 (строка 2769).
 * Тёмные пары — CSS-оверрайды: строка 96 (#6d28d9 → #c4b5fd), строка 91 (.4 → W42).
 * Блюр: в макете backdrop-filter blur(22px) — через общий glassSurface/GlassBlur
 * (src/ui/glass.ts, единый флаг fallback).
 */
import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import {
  useTheme,
  fonts,
  gradPoints,
  shadowStyle,
  type ThemeTokens,
} from "../theme";
import { Avatar, type AvatarProps } from "./Avatar";
import { GlassBlur, glassSurface } from "./glass";

/** «Сменить ребёнка ›» #6d28d9: тёмная пара — CSS строка 96. */
const LINK = { light: "#6D28D9", dark: "#C4B5FD" };
/** Хвостовой шеврон rgba(26,19,74,.4): тёмная пара — CSS строка 91. */
const CHEVRON = { light: "rgba(26,19,74,0.4)", dark: "rgba(255,255,255,0.42)" };

export interface ChildSwitcherStatus {
  /** Текст чипа, напр. «В школе». */
  label: string;
  /** Статусная семья из токенов (green/gray/…). */
  tone: keyof ThemeTokens["status"];
  /** Шеврон › внутри чипа (П5, строка 229). */
  withChevron?: boolean;
}

export interface ChildSwitcherCardProps {
  /** large — П5 Dashboard (строка 228); compact — П10/расписание (строки 281, 632). */
  variant?: "large" | "compact";
  /** Пропсы аватара (инициалы + градиент + кольцо ребёнка); size задаёт карточка. */
  avatar: Omit<AvatarProps, "size">;
  /** ФИО ребёнка. */
  name: string;
  /** Подпись класса, напр. «7-А класс». */
  classLabel: string;
  /** Статусный чип; отсутствует — не рендерится (строка 632). */
  status?: ChildSwitcherStatus;
  /** «Сменить ребёнка ›» — акцентная строка (compact, строка 281). */
  switchLabel?: string;
  /** Хвостовой шеврон › (large, строка 229). */
  chevron?: boolean;
  /** Нижний слот (метрики-сплит П5, строки 230–240). */
  footer?: ReactNode;
  onPress?: () => void;
  /** Отдельный тап по чипу статуса (goDay, строка 229). */
  onStatusPress?: () => void;
}

export function ChildSwitcherCard({
  variant = "large",
  avatar,
  name,
  classLabel,
  status,
  switchLabel,
  chevron = false,
  footer,
  onPress,
  onStatusPress,
}: ChildSwitcherCardProps) {
  const { tokens, scheme } = useTheme();
  const large = variant === "large";
  const g = gradPoints(tokens.glass1.angle);
  const st = status ? tokens.status[status.tone] : null;
  const stChip = st ? tokens.chip(st.rgb) : null;

  const statusChip =
    status && st && stChip ? (
      <Pressable
        onPress={onStatusPress}
        disabled={!onStatusPress}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: large ? 5 : 4,
            paddingVertical: large ? 5 : 4,
            paddingHorizontal: large ? 10 : 9,
            borderRadius: 999,
            backgroundColor: stChip.bg,
            borderWidth: 1,
            borderColor: stChip.border,
          },
          // Тень чипа 0 4 10 rgba(семья,.18) — только у large (строка 229).
          large && shadowStyle({ x: 0, y: 4, blur: 10, color: `rgba(${st.rgb},0.18)` }),
        ]}
      >
        <View
          style={{
            width: large ? 6 : 5,
            height: large ? 6 : 5,
            borderRadius: 3,
            backgroundColor: `rgb(${st.rgb})`,
          }}
        />
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: large ? 10 : 9.5,
            color: st.text,
          }}
        >
          {status.label}
        </Text>
        {status.withChevron ? (
          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
            <Path
              d="m9 18 6-6-6-6"
              stroke={st.text}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </Pressable>
    ) : null;

  return (
    <View style={[{ borderRadius: large ? 22 : 18 }, shadowStyle(tokens.shCard)]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={{
          borderRadius: large ? 22 : 18,
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
            paddingVertical: large ? 12 : 10,
            paddingHorizontal: large ? 14 : 12,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: large ? 11 : 10,
            }}
          >
            {/* Кольца аватара выступают наружу — компенсируем зазором. */}
            <View style={{ margin: avatar.ringColor ? 4.5 : 2 }}>
              <Avatar {...avatar} size={large ? 50 : 44} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: large ? 14.5 : 13.5,
                  color: tokens.ink1,
                }}
              >
                {name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: large ? 11.5 : 11,
                    color: tokens.ink2,
                  }}
                >
                  {classLabel}
                </Text>
                {/* Шеврон-вниз ⌄ у класса (строка 229). */}
                <Svg
                  width={large ? 11 : 10}
                  height={large ? 11 : 10}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <Path
                    d="m6 9 6 6 6-6"
                    stroke={tokens.ink2}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>
            {large ? (
              <>
                {statusChip}
                {chevron ? (
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="m9 18 6-6-6-6"
                      stroke={CHEVRON[scheme]}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                ) : null}
              </>
            ) : (
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {statusChip}
                {switchLabel ? (
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 10.5,
                      color: LINK[scheme],
                    }}
                  >
                    {switchLabel}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          {footer}
        </View>
      </Pressable>
    </View>
  );
}
