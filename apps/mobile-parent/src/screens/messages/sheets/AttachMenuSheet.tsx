/**
 * AttachMenuSheet — плавающая шторка меню вложений chat-composer'а
 * (экран #25 Chat). Заход 7, block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 786–791 + inline-стиль `attachMenu`
 * из state-блока строка 3886.
 *
 * Порядок блоков (block-list Захода 7):
 *   1. AttachMenuContainer   — абсолютный контейнер шторки, стекло + border +
 *                              shadow; условная видимость (visible → null).
 *   2. AttachMenuItem_Photo  — иконка (blue-gradient 30×30) + подпись «Фото»;
 *                              onPress → onPickPhoto (мокап goAPhoto).
 *   3. AttachMenuDivider     — 1px разделитель rgba(23,18,67,.07) (макет 790:
 *                              border-top у второго пункта).
 *   4. AttachMenuItem_File   — иконка (yellow-orange-gradient 30×30) + «Файл»;
 *                              onPress → onPickFile  (мокап goAFile).
 *
 * По ТЗ Захода 7 (block-list EXTRACT): пунктов ровно ДВА — Фото/Файл.
 * Никаких камеры/геолокации/аудио/опросов в макете НЕТ, добавлять запрещено.
 *
 * Позиционирование (мокап строка 3886): position:absolute; left:18; bottom:100%;
 * marginBottom:-88; width:150 — шторка сидит НАД composer'ом, приклеена к его
 * position:relative-обёртке (строка 787). В RN значения `bottom:'100%'` и
 * отрицательный marginBottom допустимы; сохранены по умолчанию, но родитель
 * (ChatScreen из #25) может переопределить через prop `style`. Backdrop-таппер
 * (закрытие по клику вне) — задача родителя (в мокапе — window-listener на
 * toggleAttach), здесь его не делаем, чтобы не блокировать composer.
 *
 * Стекло: светлая пара 160° W95→W85 blur24 border W90 shadow rgba(64,54,150,.28)
 * — точь-в-точь макет 3886. Тёмная пара — из общих тёмных glass-токенов
 * (POPOVER_GLASS_DARK) через тот же паттерн, что и в src/ui/Popover.tsx
 * (макетные CSS-оверрайды строки 38–42 / 61). Тень в тёмной теме — tokens.shFloat.
 *
 * i18n: макет использует ЛИТЕРАЛЫ «Фото» / «Файл» (строки 789/790). В словаре
 * parentApp ключей для attach-меню пока нет — держим литералы. Если появятся
 * ключи (напр. d.parentApp.messages.attachPhoto / attachFile) — заменить.
 * Оба theme-режима через useTheme() (ink1 для подписи; blob-градиенты иконок —
 * inline hex как в макете, они не зависят от темы).
 *
 * SafeArea: не применяется — шторка сидит ВНУТРИ composer-обёртки (position:
 * relative у родителя), которому safe-area даёт сам родительский экран.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { fonts, gradPoints, shadowStyle, useTheme, type GlassToken, type ShadowToken } from "../../../theme";
import { GlassBlur, glassSurface } from "../../../ui";

// ─── Токены-константы (макет строка 3886 + аналог из Popover) ────────────────

/** Светлое стекло меню: 160° rgba(255,255,255,.95→.85), blur 24 (макет 3886). */
const ATTACH_GLASS_LIGHT: GlassToken = {
  angle: 160,
  colors: ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.85)"],
  blur: 24,
};
/** Тёмное стекло меню: аналогично POPOVER_GLASS_DARK (CSS-оверрайды 38–42). */
const ATTACH_GLASS_DARK: GlassToken = {
  angle: 160,
  colors: ["rgba(44,36,102,0.97)", "rgba(23,18,62,0.97)"],
  blur: 24,
};
/** Светлый бордер W90 (макет 3886). */
const ATTACH_BORDER_LIGHT = "rgba(255,255,255,0.9)";
/** Тёмный бордер (CSS оверрайд строка 61). */
const ATTACH_BORDER_DARK = "rgba(255,255,255,0.18)";
/** Светлая тень 0 18 40 rgba(64,54,150,.28) (макет 3886). */
const ATTACH_SHADOW_LIGHT: ShadowToken = {
  x: 0,
  y: 18,
  blur: 40,
  color: "rgba(64,54,150,0.28)",
};
/** Ширина меню (макет 3886). */
const MENU_WIDTH = 150;
/** Радиус контейнера меню (макет 3886). */
const MENU_RADIUS = 16;
/** Разделитель между пунктами (макет строка 790: rgba(23,18,67,.07)). */
const DIVIDER_LIGHT = "rgba(23,18,67,0.07)";
const DIVIDER_DARK = "rgba(255,255,255,0.08)";

// ─── Публичный API ───────────────────────────────────────────────────────────

export interface AttachMenuSheetProps {
  /** Показывать ли меню (macет: s.attachOpen; visible=false → компонент = null). */
  visible: boolean;
  /**
   * Тап по пункту «Фото» (мокап goAPhoto). Родитель обычно и закрывает шторку,
   * и переводит на экран пикера фото. Здесь только событие.
   */
  onPickPhoto?: () => void;
  /**
   * Тап по пункту «Файл» (мокап goAFile). Аналогично onPickPhoto.
   */
  onPickFile?: () => void;
  /**
   * Переопределение позиционирования / прочих стилей контейнера. По умолчанию
   * шторка сидит НАД composer'ом (position:absolute; left:18; bottom:'100%';
   * marginBottom:8; zIndex:30). Chat-экран может подправить, если composer
   * стоит не в обёртке position:relative или padding другой.
   */
  style?: StyleProp<ViewStyle>;
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export function AttachMenuSheet({
  visible,
  onPickPhoto,
  onPickFile,
  style,
}: AttachMenuSheetProps) {
  const { tokens, scheme } = useTheme();
  const dark = scheme === "dark";

  // 1. Условная видимость (visible=false → шторки нет).
  if (!visible) return null;

  const glass = dark ? ATTACH_GLASS_DARK : ATTACH_GLASS_LIGHT;
  const surface = glassSurface(glass, scheme);
  const borderColor = dark ? ATTACH_BORDER_DARK : ATTACH_BORDER_LIGHT;
  const shadow: ShadowToken = dark ? tokens.shFloat : ATTACH_SHADOW_LIGHT;
  const dividerColor = dark ? DIVIDER_DARK : DIVIDER_LIGHT;

  return (
    // 1. AttachMenuContainer — плавающий контейнер над composer'ом.
    <View
      style={[
        {
          position: "absolute",
          left: 18,
          bottom: "100%",
          // Отступ снизу от composer'а: в мокапе итог = ~-88 + translateY(-96)
          // = -184px от composer's top → зазор ~8px выше composer'а.
          // В RN оставляем позитивный marginBottom, чтобы шторка «висела» над.
          marginBottom: 8,
          width: MENU_WIDTH,
          zIndex: 30,
          borderRadius: MENU_RADIUS,
        },
        shadowStyle(shadow),
        style,
      ]}
    >
      {/* Внутренний clip-контейнер: overflow hidden под border-radius + border. */}
      <View
        style={{
          borderRadius: MENU_RADIUS,
          overflow: "hidden",
          borderWidth: 1,
          borderColor,
        }}
      >
        {/* Фон стекла: blur + gradient (или fill-fallback). */}
        {surface.mode === "blur" ? (
          <>
            <GlassBlur
              intensity={surface.intensity}
              tint={surface.tint}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={surface.colors as [string, string, ...string[]]}
              {...gradPoints(surface.angle)}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]}
          />
        )}

        {/* 2. AttachMenuItem_Photo — иконка blue-gradient 30×30 + подпись «Фото». */}
        <MenuItem
          label="Фото"
          onPress={onPickPhoto}
          inkColor={tokens.ink1}
          icon={<PhotoIcon />}
          iconColors={["#60A5FA", "#2563EB"]}
        />

        {/* 3. AttachMenuDivider — 1px hairline между пунктами (макет 790). */}
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: dividerColor,
            marginHorizontal: 0,
          }}
        />

        {/* 4. AttachMenuItem_File — иконка yellow-orange-gradient + «Файл». */}
        <MenuItem
          label="Файл"
          onPress={onPickFile}
          inkColor={tokens.ink1}
          icon={<FileIcon />}
          iconColors={["#FBBF24", "#F97316"]}
        />
      </View>
    </View>
  );
}

export default AttachMenuSheet;

// ─── Внутренние атомы ────────────────────────────────────────────────────────

interface MenuItemProps {
  label: string;
  onPress?: () => void;
  inkColor: string;
  icon: ReactNode;
  /** Пара HEX-стопов для градиента 135° иконки (макет: fixed HEX, тема не влияет). */
  iconColors: [string, string];
}

/**
 * Пункт меню: иконка-плитка 30×30 r10 + подпись 11.5/800. Отступы 9/12 —
 * как в макете (строки 789/790).
 */
function MenuItem({ label, onPress, inkColor, icon, iconColors }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        columnGap: 9,
        paddingVertical: 9,
        paddingHorizontal: 12,
        opacity: pressed ? 0.82 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={iconColors}
          {...gradPoints(135)}
          style={StyleSheet.absoluteFill}
        />
        {icon}
      </View>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: inkColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Иконка «фото» — макет строка 789 (rect + circle + горы). */
function PhotoIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={3}
        width={18}
        height={18}
        rx={4}
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={9}
        cy={9}
        r={2}
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Иконка «файл» — макет строка 790 (документ со сгибом). */
function FileIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 3v5h5"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
