/**
 * Честные плашки: «данных нет, это пример» и «кнопка пока не работает».
 *
 * Появились в заходе 4 внутри платёжных экранов, в заходе 5 переехали сюда:
 * ровно то же объяснение нужно разделам питания, транспорта, медкарты,
 * документов, портфолио и заявлений. Второй копии не заводим —
 * `screens/payments/parts.tsx` теперь просто перевыдаёт эти же компоненты.
 *
 * Смысл разделения:
 *  · DemoBanner  — стоит СВЕРХУ раздела, объясняет весь экран целиком;
 *  · SoonNote    — раскрывается У НАЖАТОЙ кнопки, объясняет одно действие;
 *  · SoonAction  — обёртка «кнопка + её объяснение», чтобы нажатие никогда
 *                  не заканчивалось молчанием;
 *  · NoticeBanner — цветная заметка общего вида (зелёная «данные защищены»
 *                  и т. п.), из которой собран DemoBanner.
 */
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, useTheme } from "../theme";

/** Глиф «i в кружке» — им помечены все объяснения. */
const INFO_PATHS = ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 16v-4", "M12 8h.01"];

/* ── Цветная плашка-заметка ───────────────────────────────────────────────── */

export function NoticeBanner({
  family,
  paths,
  text,
}: {
  family: "green" | "blue" | "orange" | "violet";
  paths: string[];
  text: string;
}) {
  const { tokens, scheme } = useTheme();
  const st = tokens.status[family];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: `rgba(${st.rgb},0.10)`,
        borderWidth: 1,
        borderColor: `rgba(${st.rgb},0.30)`,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={st.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {paths.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.manrope600,
          fontSize: 10,
          lineHeight: 15.5,
          color: scheme === "light" ? "rgba(26,19,74,0.72)" : "rgba(255,255,255,0.78)",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/* ── Плашка «данных нет, это пример» ──────────────────────────────────────── */

/**
 * Стоит СВЕРХУ раздела, собранного из примеров. Не украшение: родитель должен
 * понимать, что перед ним, до того как начнёт нажимать.
 */
export function DemoBanner({ text }: { text: string }) {
  return <NoticeBanner family="violet" paths={INFO_PATHS} text={text} />;
}

/* ── «Появится позже» ─────────────────────────────────────────────────────── */

/**
 * Ответ на нажатие действия, которого в системе ещё нет. Показывается ПРЯМО
 * У НАЖАТОЙ кнопки, а не общим тостом наверху экрана: объяснение должно быть
 * там, где родитель только что нажал.
 */
export function SoonNote({ text }: { text: string }) {
  const { tokens } = useTheme();
  const st = tokens.status.violet;
  const chip = tokens.chip(st.rgb);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        marginTop: 8,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderRadius: 12,
        backgroundColor: chip.bg,
        borderWidth: 1,
        borderColor: chip.border,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={st.text} strokeWidth={2} strokeLinecap="round">
          {INFO_PATHS.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 10, lineHeight: 15, color: st.text }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Кнопка, которая ничего не сохраняет: по нажатию раскрывает объяснение под
 * собой и больше ничего не делает. Молчаливого бездействия быть не должно.
 */
export function SoonAction({
  children,
  note,
  open,
  onPress,
}: {
  children: ReactNode;
  note: string;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Pressable onPress={onPress} accessibilityRole="button">
        {children}
      </Pressable>
      {open ? <SoonNote text={note} /> : null}
    </View>
  );
}
