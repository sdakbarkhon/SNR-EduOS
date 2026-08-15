/**
 * Детали, общие для платёжных экранов мобильного приложения.
 *
 * Ровно те же три штуки, что у веб-родителя (`_demo` + `payments/parts.tsx`):
 * плашка «это пример», строка «пока не работает» и бренд-плитка платёжной
 * системы. Держим в одном месте, чтобы объяснение выглядело одинаково на всех
 * экранах раздела — родитель не должен гадать, где кнопка работает, а где нет.
 */
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { fonts, gradPoints, useTheme } from "../../theme";
import type { Gradient } from "../../data";

/* ── Плашка «данных нет, это пример» ──────────────────────────────────────── */

/**
 * Стоит СВЕРХУ каждого платёжного экрана. Не украшение: платёжной подсистемы
 * в проекте нет, и родитель должен понимать это до того, как начнёт нажимать.
 */
export function DemoBanner({ text }: { text: string }) {
  const { tokens, scheme } = useTheme();
  const st = tokens.status.violet;
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
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={st.text} strokeWidth={1.9} strokeLinecap="round">
          <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <Path d="M12 16v-4" />
          <Path d="M12 8h.01" />
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

/* ── «Появится позже» ─────────────────────────────────────────────────────── */

/**
 * Ответ на нажатие действия, которое упирается в отсутствующий платёжный
 * бэкенд. Показывается ПРЯМО У НАЖАТОЙ кнопки, а не общим тостом наверху
 * экрана: родитель должен увидеть объяснение там, где он только что нажал.
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
          <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <Path d="M12 16v-4" />
          <Path d="M12 8h.01" />
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

/* ── Бренд-плитка платёжной системы ───────────────────────────────────────── */

export function BrandChip({ gradient, label }: { gradient: Gradient; label: string }) {
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{ width: 40, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 7, letterSpacing: 0.28, color: "#FFFFFF" }}>
        {label}
      </Text>
    </LinearGradient>
  );
}

/* ── Цветная плашка-заметка (зелёная «платежи защищены» и т. п.) ──────────── */

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

/** Глиф щита — «платежи защищены». */
export const SHIELD_PATHS = ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"];
