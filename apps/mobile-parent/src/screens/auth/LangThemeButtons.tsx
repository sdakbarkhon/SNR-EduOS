/**
 * Две круглые glass-кнопки «Язык»/«Тема» — на онбординге и на экране входа
 * по номеру (LoginPhoneScreen). Открывают шторки с выбором ru/uz/en и
 * light/dark/system — переиспользуют РЕАЛЬНЫЕ useAppLocale()/useTheme(),
 * те же контексты, что уже работают на экране «Язык и безопасность»
 * (screens/profile/LangSecurityScreen.tsx, не тронут). Ряды/CheckDot/
 * IconTile — тот же визуальный паттерн, что и там, продублирован здесь
 * (тот экран не экспортирует их наружу).
 */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Locale } from "@snr/core";
import { useAppLocale } from "../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme, type AppearancePref } from "../../theme";
import { BottomSheetFrame, GlassCircleButton } from "../../ui";
import { CheckIcon, DeviceIcon, GlobeIcon, MoonIcon, SunIcon } from "../../ui/auth/icons";

type SheetKey = null | "lang" | "theme";

const LANGUAGE_AUTONYMS: Record<Locale, string> = { ru: "Русский", uz: "Oʻzbekcha", en: "English" };

function CheckDot({ active }: { active: boolean }) {
  const { scheme, tokens } = useTheme();
  const inactiveBorder = scheme === "dark" ? "rgba(255,255,255,0.28)" : "rgba(23,18,67,0.22)";
  if (!active) {
    return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: inactiveBorder }} />;
  }
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <LinearGradient
        colors={tokens.accentGrad.colors as [string, string]}
        {...gradPoints(tokens.accentGrad.angle)}
        style={StyleSheet.absoluteFill}
      />
      <CheckIcon />
    </View>
  );
}

function CardRow({ onPress, divider, children }: { onPress: () => void; divider: boolean; children: ReactNode }) {
  const { scheme } = useTheme();
  const divColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: "row" as const, alignItems: "center" as const, gap: 11, paddingVertical: 10, borderTopWidth: divider ? 1 : 0, borderTopColor: divColor },
        pressed ? { opacity: 0.75 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

function IconTile({ gradient, shadowRgb, children }: { gradient: [string, string]; shadowRgb: string; children: ReactNode }) {
  return (
    <View
      style={[
        { width: 36, height: 36, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
        shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${shadowRgb},0.3)` }),
      ]}
    >
      <LinearGradient colors={gradient} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

export function LangThemeButtons() {
  const { d, locale, setLocale } = useAppLocale();
  const { tokens, scheme, appearance, setAppearance } = useTheme();
  const set = d.parentApp.set;

  const [sheet, setSheet] = useState<SheetKey>(null);

  const languageRows: { value: Locale; name: string; sub: string }[] = [
    { value: "ru", name: set.langRu, sub: LANGUAGE_AUTONYMS.ru },
    { value: "uz", name: set.langUz, sub: LANGUAGE_AUTONYMS.uz },
    { value: "en", name: set.langEn, sub: LANGUAGE_AUTONYMS.en },
  ];

  const appearanceRows: { value: AppearancePref; title: string; subtitle: string; gradient: [string, string]; shadowRgb: string; icon: ReactNode }[] = [
    { value: "light", title: set.light, subtitle: set.lightSub, gradient: ["#fbbf24", "#f97316"], shadowRgb: "249,115,22", icon: <SunIcon /> },
    { value: "dark", title: set.dark, subtitle: set.darkSub, gradient: ["#a78bfa", "#7c3aed"], shadowRgb: "124,58,237", icon: <MoonIcon /> },
    { value: "system", title: set.system, subtitle: set.systemSub, gradient: ["#60a5fa", "#2563eb"], shadowRgb: "37,99,235", icon: <DeviceIcon /> },
  ];

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <GlassCircleButton onPress={() => setSheet("lang")}>
          <GlobeIcon color={tokens.ink1} />
        </GlassCircleButton>
        <GlassCircleButton onPress={() => setSheet("theme")}>
          {scheme === "dark" ? <MoonIcon color={tokens.ink1} /> : <SunIcon color={tokens.ink1} />}
        </GlassCircleButton>
      </View>

      <BottomSheetFrame visible={sheet === "lang"} onClose={() => setSheet(null)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1, marginBottom: 4 }}>{set.appLanguage}</Text>
          {languageRows.map((row, i) => (
            <CardRow key={row.value} divider={i > 0} onPress={() => { setLocale(row.value); setSheet(null); }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>{row.name}</Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>{row.sub}</Text>
              </View>
              <CheckDot active={locale === row.value} />
            </CardRow>
          ))}
        </View>
      </BottomSheetFrame>

      <BottomSheetFrame visible={sheet === "theme"} onClose={() => setSheet(null)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1, marginBottom: 4 }}>{set.appearance}</Text>
          {appearanceRows.map((row, i) => (
            <CardRow key={row.value} divider={i > 0} onPress={() => { setAppearance(row.value); setSheet(null); }}>
              <IconTile gradient={row.gradient} shadowRgb={row.shadowRgb}>
                {row.icon}
              </IconTile>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>{row.title}</Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>{row.subtitle}</Text>
              </View>
              <CheckDot active={appearance === row.value} />
            </CardRow>
          ))}
        </View>
      </BottomSheetFrame>
    </>
  );
}
