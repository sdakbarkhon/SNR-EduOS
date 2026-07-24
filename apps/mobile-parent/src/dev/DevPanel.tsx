/**
 * ВРЕМЕННАЯ DEV-ПАНЕЛЬ — снести в Заходе 8.
 *
 * Плавающая кнопка поверх всего UI (правый край, выше таб-бара), открывает
 * панель: Тема — Светлая / Тёмная / Системная (useTheme), Язык — RU / UZ / EN
 * (существующий useAppLocale из src/i18n). Смонтирована ВСЕГДА (OTA-бандл
 * production: __DEV__ === false, поэтому гейтить по __DEV__ нельзя —
 * заказчик смотрит прод-бандл через Expo Go).
 */
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Locale } from "@snr/core";
import { locales } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useTheme, fonts, type AppearancePref } from "../theme";
import { DevGallery } from "./DevGallery";

const APPEARANCE_VALUES: AppearancePref[] = ["light", "dark", "system"];

function OptionChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? tokens.accent : tokens.chip(tokens.status.violet.rgb).bg,
        borderWidth: 1,
        borderColor: active ? tokens.accent : tokens.chip(tokens.status.violet.rgb).border,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 12,
          color: active ? "#ffffff" : tokens.status.violet.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const { tokens, scheme, appearance, setAppearance } = useTheme();
  const { d, locale, setLocale } = useAppLocale();
  const insets = useSafeAreaInsets();

  // Лейблы из словаря макета: set.light / set.dark / set.system
  const appearanceLabels: Record<AppearancePref, string> = {
    light: d.parentApp.set.light,
    dark: d.parentApp.set.dark,
    system: d.parentApp.set.system,
  };

  const panelBg = scheme === "dark" ? "rgba(30,24,80,0.98)" : "rgba(255,255,255,0.98)";

  return (
    <>
      {/* Плавающая кнопка: правый край, заведомо выше таб-бара (~49–80px) */}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          position: "absolute",
          right: 12,
          bottom: insets.bottom + 110,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.accent,
          shadowColor: tokens.shFloat.color,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 12,
          shadowOpacity: 1,
          elevation: 8,
          zIndex: 1000,
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#ffffff" }}>DEV</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(5,3,20,0.5)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              margin: 8,
              marginBottom: insets.bottom + 8,
              borderRadius: 24,
              padding: 18,
              gap: 14,
              backgroundColor: panelBg,
              borderWidth: 1,
              borderColor: tokens.glassBorder,
            }}
          >
            <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1 }}>
              Dev-панель (временная)
            </Text>

            <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2 }}>
              {d.parentApp.set.appearance}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {APPEARANCE_VALUES.map((value) => (
                <OptionChip
                  key={value}
                  label={appearanceLabels[value]}
                  active={appearance === value}
                  onPress={() => setAppearance(value)}
                />
              ))}
            </View>

            <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2 }}>
              {d.parentApp.set.appLanguage}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(locales as Locale[]).map((loc) => (
                <OptionChip
                  key={loc}
                  label={loc.toUpperCase()}
                  active={locale === loc}
                  onPress={() => setLocale(loc)}
                />
              ))}
            </View>

            {/* Каталог компонентов UI-кита v2 (временный, Заход 2) */}
            <Pressable
              onPress={() => {
                setOpen(false);
                setGalleryOpen(true);
              }}
              style={{
                alignItems: "center",
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: tokens.chip(tokens.status.violet.rgb).bg,
                borderWidth: 1,
                borderColor: tokens.chip(tokens.status.violet.rgb).border,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12.5,
                  color: tokens.status.violet.text,
                }}
              >
                Галерея UI
              </Text>
            </Pressable>

            <Pressable onPress={() => setOpen(false)} style={{ alignSelf: "flex-end", padding: 6 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>
                {d.parentApp.common.close}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ВРЕМЕННАЯ галерея UI-кита — снести в Заходе 8 вместе с DevPanel. */}
      <DevGallery visible={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </>
  );
}
