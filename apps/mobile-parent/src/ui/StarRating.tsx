/**
 * StarRating — 5 SVG-звёзд, перенос 1:1 из макета «SNR EduOS v2 Light.dc.html».
 * Спека: карточка «Средний балл» П10 (строка 284) — звёзды 14px, gap 2,
 * заполненные fill #fff, приглушённая rgba(255,255,255,.35) (на градиентной карточке).
 * Путь звезды — дословно из макета (строки 284, 3530).
 * Цвета на стекле задаются через props color/mutedColor.
 */
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/** Путь звезды из макета (строка 284). */
const STAR_PATH =
  "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z";

export interface StarRatingProps {
  /** Число заполненных звёзд (0..total). */
  count: number;
  /** Всего звёзд (по умолчанию 5). */
  total?: number;
  /** Размер звезды, px (макет: 14 на карточке П10, 10–11 в чипах). */
  size?: number;
  /** Цвет заполненной звезды (на градиенте — #fff). */
  color?: string;
  /** Цвет приглушённой звезды (на градиенте — W35, строка 284). */
  mutedColor?: string;
  /** Зазор между звёздами (макет: 2). */
  gap?: number;
}

export function StarRating({
  count,
  total = 5,
  size = 14,
  color = "#FFFFFF",
  mutedColor = "rgba(255,255,255,0.35)",
  gap = 2,
}: StarRatingProps) {
  return (
    <View style={{ flexDirection: "row", gap }}>
      {Array.from({ length: total }, (_, i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={i < count ? color : mutedColor} />
        </Svg>
      ))}
    </View>
  );
}
