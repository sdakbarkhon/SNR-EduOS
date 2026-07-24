/**
 * RootHeader — шапка корневых экранов (табов).
 * Спека: «SNR EduOS v2 Light.dc.html»:
 *  П5 (строки 220–224): row gap 10, padding 46 18 8; лого-знак 32×32
 *   (uploads/snr-logo-mark.png) + название Unbounded 14/600; справа —
 *   круглая стеклянная кнопка колокольчика 38 (160° W72→W46, blur(18),
 *   border W80; глиф bell 17 stroke 1.8) с бейджем CountBadge 17
 *   (top -3 right -3, строка 223) и аватар 38 (градиент 135°, кольцо
 *   0 0 0 2px #fff — Avatar variant ring, инициалы 12/800);
 *  П10/П17 (строки 274–278, 377–380): та же шапка, заголовок Unbounded 17/600,
 *   на П17 без лого.
 * NB: отдельного знака в apps/mobile-parent/assets нет (только logo-full.png
 *  с полным словом) — используем Image logo-full.png высотой 32 (см. отчёт).
 * Тёмные пары: стекло кнопки — glass1/glassBorder тёмных токенов (CSS 28, 56);
 *  глиф #171243 → #fff (CSS 162) — через tokens.ink1.
 * paddingTop — max(safe-area, 46) (в макете 46). Presentational: все данные
 * и обработчики — через props; тема — useTheme().
 */
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, gradPoints, useTheme } from "../theme";
import { Avatar, type AvatarProps } from "./Avatar";
import { CountBadge } from "./CountBadge";
import { GlassBlur, glassSurface } from "./glass";

/** Колокольчик (ICONS.bell макета, 17px stroke 1.8 — строка 223). */
const BELL_PATHS = [
  "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
  "M10.3 21a1.94 1.94 0 0 0 3.4 0",
];

export interface RootHeaderProps {
  /** Заголовок: «SNR EduOS» (П5, 14px) или имя раздела (П10/П17, 17px). */
  title: string;
  /** Размер заголовка Unbounded 600: 14 — П5, 17 — остальные корневые. */
  titleSize?: 14 | 17;
  /** Показать лого-знак 32×32 слева (П5/П10; П17 — без). */
  showLogo?: boolean;
  /** Бейдж колокольчика (0/undefined — без бейджа). */
  bellCount?: number;
  onBellPress?: () => void;
  /** Аватар родителя 38 (инициалы + градиент); size задаёт шапка. */
  avatar?: Omit<AvatarProps, "size">;
  onAvatarPress?: () => void;
  /** Доп. правый слот (перед колокольчиком). */
  right?: ReactNode;
}

/**
 * Круглая стеклянная кнопка 38 (строка 223: 160° W72→W46 + blur(18) + border W80).
 * Экспортируется для InnerHeader (та же кнопка с глифом «назад»).
 */
export function GlassCircleButton({
  onPress,
  children,
}: {
  onPress?: () => void;
  children?: ReactNode;
}) {
  const { tokens, scheme } = useTheme();
  // Цвета glass1, blur(18) из макета (строка 223); тёмная пара — glass1 dark.
  const surface = glassSurface({ ...tokens.glass1, blur: 18 }, scheme);
  const g = gradPoints(tokens.glass1.angle);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ width: 38, height: 38, borderRadius: 19 }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 19,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {surface.mode === "blur" ? (
          <>
            <GlassBlur
              intensity={surface.intensity}
              tint={surface.tint}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={tokens.glass1.colors as [string, string]}
              start={g.start}
              end={g.end}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
        )}
        {children}
      </View>
    </Pressable>
  );
}

export function RootHeader({
  title,
  titleSize = 17,
  showLogo = false,
  bellCount,
  onBellPress,
  avatar,
  onAvatarPress,
  right,
}: RootHeaderProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingTop: Math.max(insets.top, 46),
        paddingHorizontal: 18,
        paddingBottom: 8,
      }}
    >
      {showLogo ? (
        // В макете — квадратный знак 32×32 (snr-logo-mark.png); в assets есть
        // только полный логотип — рендерим его высотой 32 (contain).
        <Image
          source={require("../../assets/logo-full.png")}
          style={{ width: 94, height: 32, flexShrink: 0 }}
          resizeMode="contain"
        />
      ) : null}
      <Text
        style={{
          fontFamily: fonts.unbounded600,
          fontSize: titleSize,
          color: tokens.ink1,
        }}
      >
        {title}
      </Text>
      <View style={{ flex: 1 }} />
      {right}
      <View style={{ position: "relative" }}>
        <GlassCircleButton onPress={onBellPress}>
          <Svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.ink1}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {BELL_PATHS.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </Svg>
        </GlassCircleButton>
        {bellCount ? (
          // Бейдж 17 r9, top -3 right -3 (строка 223).
          <CountBadge
            value={bellCount}
            preset="alert"
            size={17}
            style={{ position: "absolute", top: -3, right: -3 }}
          />
        ) : null}
      </View>
      {avatar ? (
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress}>
          {/* Аватар 38, инициалы 12/800, кольцо 2px (строка 224). */}
          <Avatar {...avatar} size={38} fontSize={12} />
        </Pressable>
      ) : null}
    </View>
  );
}
