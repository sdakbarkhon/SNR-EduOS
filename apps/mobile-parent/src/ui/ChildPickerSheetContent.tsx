/**
 * ChildPickerSheetContent — содержимое шторки «Выберите ребёнка», перенос 1:1
 * из макета «SNR EduOS v2 Light.dc.html» (строки 2632–2644 + kidRows 4377–4383):
 *   заголовок 14/800 #171243, padding 2 20 10;
 *   строка: padding 11 20, gap 12, аватар 44 с двойным кольцом (av(kk,44)),
 *     имя 13.5/800, класс 11/700 rgba(26,19,74,.62),
 *     чип статуса 9.5/800 (зелёная/серая семья, строка 4380),
 *     галочка 22px: выбран — градиент 135° accent + тень 0 4 10 rgba(124,58,237,.4),
 *     не выбран — rgba(23,18,67,.08) (строка 4381);
 *   нижний отступ 18 (строка 2644).
 * Каркас шторки (панель, оверлей, ручка) — компонент группы A; здесь только контент.
 * Тёмные пары — CSS-оверрайды: строка 113 (фон галочки .08 → W12).
 */
import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import {
  useTheme,
  fonts,
  gradPoints,
  shadowStyle,
  type ThemeTokens,
} from "../theme";
import { Avatar } from "./Avatar";

/** Фон невыбранной галочки rgba(23,18,67,.08): тёмная пара — CSS строка 113. */
const CHECK_OFF_BG = { light: "rgba(23,18,67,0.08)", dark: "rgba(255,255,255,0.12)" };
/** Тень выбранной галочки (строка 4381). */
const CHECK_ON_SHADOW = { x: 0, y: 4, blur: 10, color: "rgba(124,58,237,0.4)" };

export interface ChildPickerItem {
  id: string;
  /** Инициал(ы) для аватара. */
  initials: string;
  /** Градиент аватара 135°. */
  gradient: [string, string];
  /** Цвет внешнего кольца ребёнка (av(), строка 3832). */
  ringColor?: string;
  /** ФИО. */
  name: string;
  /** Подпись класса, напр. «7-А класс». */
  classLabel: string;
  /** Текст чипа статуса, напр. «В школе» / «Дома». */
  statusLabel: string;
  /** Статусная семья: «В школе» — green, иначе gray (строка 4380). */
  statusTone: keyof ThemeTokens["status"];
}

export interface ChildPickerSheetContentProps {
  /** Заголовок шторки («Выберите ребёнка»). */
  title: string;
  items: ChildPickerItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function ChildPickerSheetContent({
  title,
  items,
  selectedId,
  onSelect,
}: ChildPickerSheetContentProps) {
  const { tokens, scheme } = useTheme();
  const g = gradPoints(tokens.accentGrad.angle);

  return (
    <View>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: tokens.ink1,
          paddingTop: 2,
          paddingHorizontal: 20,
          paddingBottom: 10,
        }}
      >
        {title}
      </Text>
      {items.map((item) => {
        const selected = item.id === selectedId;
        const st = tokens.status[item.statusTone];
        const chip = tokens.chip(st.rgb);
        return (
          <Pressable
            key={item.id}
            onPress={onSelect ? () => onSelect(item.id) : undefined}
            disabled={!onSelect}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 11,
              paddingHorizontal: 20,
            }}
          >
            {/* Кольца аватара выступают наружу — компенсируем зазором. */}
            <View style={{ margin: item.ringColor ? 4.5 : 2 }}>
              <Avatar
                initials={item.initials}
                gradient={item.gradient}
                ringColor={item.ringColor}
                size={44}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 13.5,
                  color: tokens.ink1,
                }}
              >
                {item.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 11,
                  color: tokens.ink2,
                }}
              >
                {item.classLabel}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 9,
                borderRadius: 999,
                backgroundColor: chip.bg,
                borderWidth: 1,
                borderColor: chip.border,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 9.5,
                  color: st.text,
                }}
              >
                {item.statusLabel}
              </Text>
            </View>
            {/* Галочка выбранного (строка 4381). */}
            {selected ? (
              <View
                style={[{ borderRadius: 11 }, shadowStyle(CHECK_ON_SHADOW)]}
              >
                <LinearGradient
                  colors={[tokens.accentGrad.colors[0], tokens.accentGrad.colors[1]]}
                  start={g.start}
                  end={g.end}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6 9 17l-5-5"
                      stroke="#FFFFFF"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </LinearGradient>
              </View>
            ) : (
              // В макете белая галочка рендерится и у невыбранных (строка 2641).
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: CHECK_OFF_BG[scheme],
                }}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6 9 17l-5-5"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            )}
          </Pressable>
        );
      })}
      <View style={{ height: 18 }} />
    </View>
  );
}
