/**
 * AuthHelpSheet — «Нужна помощь?» (макет authSheet='help').
 * Заголовок + подсказка + 2 контактных строки (телефон/email) + CTA «Закрыть».
 */
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame, PrimaryButton } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { MailIcon, PhoneIcon } from "../../../ui/auth/icons";

export interface AuthHelpSheetProps {
  visible: boolean;
  onClose(): void;
}

export function AuthHelpSheet({ visible, onClose }: AuthHelpSheetProps) {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens } = useTheme();
  const gr = gradPoints(135);

  const rows = [
    { title: t.helpPhoneRowTitle, value: t.helpPhoneValue, grad: ["#34D399", "#059669"] as [string, string], icon: <PhoneIcon size={18} /> },
    { title: t.helpEmailRowTitle, value: t.helpEmailValue, grad: ["#60A5FA", "#2563EB"] as [string, string], icon: <MailIcon size={18} /> },
  ];

  return (
    <BottomSheetFrame visible={visible} onClose={onClose}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1, paddingHorizontal: 20, paddingTop: 2 }}>
        {t.helpTitle}
      </Text>
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink2, paddingHorizontal: 20, paddingTop: 3, paddingBottom: 8 }}>
        {t.helpSub}
      </Text>
      <View style={{ paddingHorizontal: 20 }}>
        {rows.map((r, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: "rgba(23,18,67,0.06)",
            }}
          >
            <View style={[shadowStyle({ x: 0, y: 6, blur: 14, color: `${r.grad[1]}66` }), { borderRadius: 13 }]}>
              <LinearGradient
                colors={r.grad}
                start={gr.start}
                end={gr.end}
                style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
              >
                {r.icon}
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>{r.title}</Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>{r.value}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 }}>
        <PrimaryButton label={t.close} onPress={onClose} />
      </View>
    </BottomSheetFrame>
  );
}

export default AuthHelpSheet;
