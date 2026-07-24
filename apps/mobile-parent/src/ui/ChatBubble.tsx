/**
 * ChatBubble — пузыри чата, перенос 1:1 из макета «SNR EduOS v2 Light.dc.html»:
 *   §s7 чат-пузыри (строки 2775–2776):
 *     входящий — стекло rgba(255,255,255,.62), border 1px rgba(255,255,255,.8),
 *       радиусы 15 15 15 5, текст 11.5/600 #171243, время 9/700 rgba(26,19,74,.45);
 *     исходящий — градиент 135° #7C46EF→#3B6DF6, радиусы 15 15 5 15,
 *       тень 0 8px 18px rgba(124,58,237,.32), текст 11.5/600 #fff,
 *       время 9/700 rgba(255,255,255,.8) + двойная галочка (SVG 18×12, stroke #fff);
 *   экран 25 «Чат» (строки 779–785): max-width 78%, padding 9 12, колонка gap 3,
 *     время у правого края.
 * Тёмные пары — CSS-оверрайды: строка 46 (.62 → W10), строка 56 (border .8 → W16),
 * строка 89 (время .45 → W48). Градиент исходящего одинаков в обеих темах.
 */
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, fonts, gradPoints, shadowStyle } from "../theme";

/** Входящий фон rgba(255,255,255,.62): тёмная пара — CSS строка 46. */
const IN_BG = { light: "rgba(255,255,255,0.62)", dark: "rgba(255,255,255,0.1)" };
/** Входящий бордер rgba(255,255,255,.8): тёмная пара — CSS строка 56. */
const IN_BORDER = { light: "rgba(255,255,255,0.8)", dark: "rgba(255,255,255,0.16)" };
/** Время входящего rgba(26,19,74,.45): тёмная пара — CSS строка 89. */
const IN_TIME = { light: "rgba(26,19,74,0.45)", dark: "rgba(255,255,255,0.48)" };
/** Градиент исходящего 135° (строка 2776) — не совпадает с accentGrad, локально. */
const OUT_GRADIENT: [string, string] = ["#7C46EF", "#3B6DF6"];
/** Тень исходящего (строка 2776); в тёмной теме макет пары не задаёт — та же. */
const OUT_SHADOW = { x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.32)" };
const OUT_TIME = "rgba(255,255,255,0.8)";

export interface ChatBubbleProps {
  /** Направление: in — собеседник (слева), out — свой (справа). */
  direction: "in" | "out";
  /** Текст сообщения, 11.5/600. */
  text: string;
  /** Время, 9/700. */
  time?: string;
  /** Двойная галочка у исходящего (строка 2776). */
  ticks?: boolean;
  /** Максимальная ширина (макет: 78% на экране, 75% в §s7). */
  maxWidth?: number | `${number}%`;
}

export function ChatBubble({
  direction,
  text,
  time,
  ticks = false,
  maxWidth = "78%",
}: ChatBubbleProps) {
  const { tokens, scheme } = useTheme();
  const out = direction === "out";
  const g = gradPoints(135);

  const timeRow = time ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        alignSelf: "flex-end",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope700,
          fontSize: 9,
          color: out ? OUT_TIME : IN_TIME[scheme],
        }}
      >
        {time}
      </Text>
      {out && ticks ? (
        // Двойная галочка (строка 2776): SVG 12×9, viewBox 18×12, stroke #fff.
        <Svg width={12} height={9} viewBox="0 0 18 12" fill="none">
          <Path
            d="m1 6 4 4L13 2"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m7 8 2 2L17 2"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  ) : null;

  const content = (
    <>
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 11.5,
          lineHeight: 11.5 * 1.5,
          color: out ? "#FFFFFF" : tokens.ink1,
        }}
      >
        {text}
      </Text>
      {timeRow}
    </>
  );

  if (out) {
    return (
      <View style={[{ maxWidth, alignSelf: "flex-end" }, shadowStyle(OUT_SHADOW)]}>
        <LinearGradient
          colors={OUT_GRADIENT}
          start={g.start}
          end={g.end}
          style={{
            paddingVertical: 9,
            paddingHorizontal: 12,
            gap: 3,
            borderTopLeftRadius: 15,
            borderTopRightRadius: 15,
            borderBottomLeftRadius: 15,
            borderBottomRightRadius: 5,
          }}
        >
          {content}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={{
        maxWidth,
        alignSelf: "flex-start",
        paddingVertical: 9,
        paddingHorizontal: 12,
        gap: 3,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 15,
        backgroundColor: IN_BG[scheme],
        borderWidth: 1,
        borderColor: IN_BORDER[scheme],
      }}
    >
      {content}
    </View>
  );
}
