/**
 * Avatar — инициалы на градиенте, перенос 1:1 из макета «SNR EduOS v2 Light.dc.html».
 * Спека: §s6 «Аватары и фото» (строки 2756–2764) + хелпер av() (строка 3832):
 *   av(kk, sz): круг sz, fontSize sz*0.3, fw800 #fff, градиент 135°,
 *   box-shadow 0 0 0 2px #fff + 0 0 0 4.5px ring (двойное кольцо ребёнка).
 * Списочный аватар (строки 2759, 3580): одинарное белое кольцо 2px + онлайн-точка.
 * Сторис-вариант (строки 755–760, 2760): кольцо 2.5px accent-градиента,
 *   белый зазор 2px, аватар внутри.
 * RN не умеет box-shadow-кольца — рисуем вложенными View с borderWidth:
 *   кольца plain/ring выступают наружу (как box-shadow, не меняют layout),
 *   у 'story' size — полный внешний размер (в макете кольцо в padding).
 */
import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, fonts, gradPoints } from "../theme";

/** Онлайн-точка: макет строки 2759/3581 — 12px #22c55e, border 2px #fff. */
const ONLINE_GREEN = "#22C55E";
/**
 * Внутреннее кольцо — #fff в ОБЕИХ темах: CSS-оверрайдов тёмной темы для
 * колец аватаров в макете нет (строки 23–190), т.е. макет держит белое
 * кольцо и на тёмном фоне. Перенос 1:1.
 */
const INNER_RING = "#FFFFFF";

export interface AvatarProps {
  /** Инициалы (1–2 буквы). */
  initials: string;
  /** Градиент 135° [from, to] — из данных ребёнка/учителя. */
  gradient: [string, string];
  /** Диаметр круга с инициалами, 34–56 (макет: 34/38/40/44/46/50/54/56). */
  size?: number;
  /**
   * plain — без колец; ring — белое 2px (списки, строка 3580);
   * story — кольцо 2.5px градиента + белый зазор 2px (строки 755–760).
   */
  variant?: "plain" | "ring" | "story";
  /** Цвет внешнего кольца ребёнка (0 0 0 4.5px ring, строка 3832). */
  ringColor?: string;
  /** Градиент сторис-кольца; по умолчанию accent-градиент темы. */
  storyGradient?: [string, string];
  /** Онлайн-точка 12px #22C55E (строка 2759). */
  online?: boolean;
  /** Размер онлайн-точки (12 у 46px, 11 у 40–44px — строки 772, 3581). */
  onlineSize?: number;
  /** Переопределение fontSize (по умолчанию size*0.3 — av(), строка 3832). */
  fontSize?: number;
}

export function Avatar({
  initials,
  gradient,
  size = 44,
  variant = "ring",
  ringColor,
  storyGradient,
  online = false,
  onlineSize = 12,
  fontSize,
}: AvatarProps) {
  const { tokens } = useTheme();
  const grad = gradPoints(135);
  const innerRing = INNER_RING;
  const fSize = fontSize ?? Math.round(size * 0.3);

  const face = (d: number): ReactNode => (
    <LinearGradient
      colors={[gradient[0], gradient[1]]}
      start={grad.start}
      end={grad.end}
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: fSize,
          color: "#FFFFFF",
        }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );

  const dot = online ? (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        width: onlineSize,
        height: onlineSize,
        borderRadius: onlineSize / 2,
        backgroundColor: ONLINE_GREEN,
        borderWidth: 2,
        borderColor: innerRing,
      }}
    />
  ) : null;

  if (variant === "story") {
    const sg = storyGradient ?? (tokens.accentGrad.colors as [string, string]);
    // Сторис: size = внешний диаметр; кольцо 2.5px градиента + зазор 2px (строка 755).
    return (
      <View style={{ width: size, height: size }}>
        <LinearGradient
          colors={[sg[0], sg[1]]}
          start={grad.start}
          end={grad.end}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            padding: 2.5,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: size / 2,
              padding: 2,
              backgroundColor: innerRing,
            }}
          >
            {face(size - 9)}
          </View>
        </LinearGradient>
        {dot}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      {variant === "ring" && ringColor ? (
        // Внешнее кольцо ребёнка: 0 0 0 4.5px ring (строка 3832) — толщина 2.5 поверх белого 2px.
        <View
          pointerEvents="none"
          style={[
            styles.ringOverlay,
            {
              margin: -4.5,
              borderRadius: (size + 9) / 2,
              borderWidth: 2.5,
              borderColor: ringColor,
            },
          ]}
        />
      ) : null}
      {variant === "ring" ? (
        // Белое кольцо 2px: box-shadow 0 0 0 2px #fff (строки 2759, 3580).
        <View
          pointerEvents="none"
          style={[
            styles.ringOverlay,
            {
              margin: -2,
              borderRadius: (size + 4) / 2,
              borderWidth: 2,
              borderColor: innerRing,
            },
          ]}
        />
      ) : null}
      {face(size)}
      {dot}
    </View>
  );
}

const styles = StyleSheet.create({
  ringOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
