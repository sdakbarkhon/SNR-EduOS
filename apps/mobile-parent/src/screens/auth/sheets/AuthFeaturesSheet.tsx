/**
 * AuthFeaturesSheet — «Возможности приложения» (макет authSheet='more',
 * строки 2073–2088 «SNR EduOS v2 Light.dc.html»).
 * 4 строки фич с градиентными иконками + CTA «Закрыть».
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame, PrimaryButton } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { ChatIcon, CheckSquareIcon, ClipboardIcon, CreditCardIcon } from "../../../ui/auth/icons";

export interface AuthFeaturesSheetProps {
  visible: boolean;
  onClose(): void;
}

interface Row {
  title: string;
  sub: string;
  grad: [string, string];
  icon: ReactNode;
}

export function AuthFeaturesSheet({ visible, onClose }: AuthFeaturesSheetProps) {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens } = useTheme();
  const gr = gradPoints(135);

  const rows: Row[] = [
    { title: t.featEduTitle,  sub: t.featEduSub,  grad: ["#34D399", "#059669"], icon: <CheckSquareIcon size={18} /> },
    { title: t.featHwTitle,   sub: t.featHwSub,   grad: ["#60A5FA", "#2563EB"], icon: <ClipboardIcon size={18} /> },
    { title: t.featPayTitle,  sub: t.featPaySub,  grad: ["#FB923C", "#EF4444"], icon: <CreditCardIcon size={18} /> },
    { title: t.featChatTitle, sub: t.featChatSub, grad: ["#A78BFA", "#7C3AED"], icon: <ChatIcon size={18} /> },
  ];

  return (
    <BottomSheetFrame visible={visible} onClose={onClose}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1, paddingHorizontal: 20, paddingTop: 2 }}>
        {t.moreTitle}
      </Text>
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink2, paddingHorizontal: 20, paddingTop: 3, paddingBottom: 8 }}>
        {t.moreIntro}
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
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>{r.sub}</Text>
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

export default AuthFeaturesSheet;
