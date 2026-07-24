/**
 * AuthHelpSheet — bottom-sheet «Нужна помощь?» из макета
 * «SNR EduOS v2 Light.dc.html» (строки 2070–2092, конфиг 4275–4288).
 *
 * Полный block-list (сверху вниз):
 *   1. Overlay backdrop            — BottomSheetFrame (overlay + blur + tap-to-close)
 *   2. Bottom sheet panel          — BottomSheetFrame (glass panel r30, translateY)
 *   3. Handle bar                  — BottomSheetFrame (44×5 pill, tap-to-close)
 *   4. Title «Нужна помощь?»       — Text 14/800 #171243, pad 2/20/0
 *   5. Subtitle-описание           — Text 10/600 ink2, line-height 1.5, pad 3/20/8
 *   6. Info-row: Телефон школы     — 36px иконка (грин-градиент) + title/subtitle
 *   7. Info-row: Email             — 36px иконка (синий градиент) + title/subtitle
 *   8. CTA «Закрыть»               — PrimaryButton (accent-градиент), pad 10/20/18
 */

import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { BottomSheetFrame, PrimaryButton } from "../../../ui";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { useAppLocale } from "../../../i18n";
import { MailIcon, PhoneIcon } from "../../../ui/auth/icons";

export interface AuthHelpSheetProps {
  visible: boolean;
  onClose(): void;
}

interface HelpRow {
  title: string;
  subtitle: string;
  grad: [string, string];
  icon: ReactNode;
}

export function AuthHelpSheet({ visible, onClose }: AuthHelpSheetProps) {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens } = useTheme();
  const gr = gradPoints(135);

  // authInfoRows (макет 4280) — для authSheet='help' 2 строки: телефон и email.
  const rows: HelpRow[] = [
    {
      title: t.helpPhoneRowTitle,
      subtitle: t.helpPhoneValue,
      grad: ["#34D399", "#059669"],
      icon: <PhoneIcon size={18} color="#FFFFFF" />,
    },
    {
      title: t.helpEmailRowTitle,
      subtitle: t.helpEmailValue,
      grad: ["#60A5FA", "#2563EB"],
      icon: <MailIcon size={18} color="#FFFFFF" />,
    },
  ];

  return (
    <BottomSheetFrame visible={visible} onClose={onClose}>
      {/* 4. Title */}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: tokens.ink1,
          paddingHorizontal: 20,
          paddingTop: 2,
        }}
      >
        {t.helpTitle}
      </Text>

      {/* 5. Subtitle */}
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 10,
          lineHeight: 15,
          color: tokens.ink2,
          paddingHorizontal: 20,
          paddingTop: 3,
          paddingBottom: 8,
        }}
      >
        {t.helpSub}
      </Text>

      {/* 6–7. Info-rows (padding 0 20 из макета sc-for контейнера) */}
      <View style={{ paddingHorizontal: 20 }}>
        {rows.map((row, i) => (
          <View
            key={row.title}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: "rgba(23,18,67,0.06)",
            }}
          >
            <View
              style={[
                shadowStyle({ x: 0, y: 6, blur: 14, color: `${row.grad[1]}66` }),
                { borderRadius: 13 },
              ]}
            >
              <LinearGradient
                colors={row.grad}
                start={gr.start}
                end={gr.end}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {row.icon}
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                {row.title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: tokens.ink2,
                  marginTop: 2,
                }}
              >
                {row.subtitle}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 8. CTA «Закрыть» */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 }}>
        <PrimaryButton label={t.close} onPress={onClose} />
      </View>
    </BottomSheetFrame>
  );
}

export default AuthHelpSheet;
