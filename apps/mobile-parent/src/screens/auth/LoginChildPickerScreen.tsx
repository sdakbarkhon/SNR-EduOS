/**
 * Вход 4 — LoginChildPickerScreen (макет layerA4, строки 2045–2062).
 * Шапка (back), заголовок «Выберите ребёнка», список детей текущего родителя
 * через ChildPickerSheetContent (Заход 2), security-стрип, PrimaryButton
 * «Продолжить» → enterApp(authSel). Пропуск при одном ребёнке — решается
 * в AuthSessionContext (verifyCode/pickDemoParent).
 */
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts } from "../../theme";
import { ChildPickerSheetContent, GlassCard, GlassCircleButton, PrimaryButton } from "../../ui";
import { BackArrowIcon, ShieldCheckIcon } from "../../ui/auth/icons";
import { getChildren } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";

export function LoginChildPickerScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const status = d.parentApp.status;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { kidsCount, authSel, pickChildIndex, enterApp, setPhase } = useAuthSession();

  // Показываем детей текущего демо-родителя: первые kidsCount из CHILDREN
  // (макет: KIDS.slice(0, kidsN), строка 4264).
  const kids = getChildren().slice(0, Math.max(1, kidsCount));

  const items = kids.map((k) => ({
    id: k.id,
    initials: k.first_name[0] ?? "",
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: k.class_name,
    statusLabel: k.status_chip === "В школе" ? status.atSchool : k.status_chip,
    statusTone: (k.status_chip === "В школе" ? "green" : "gray") as "green" | "gray",
  }));

  const selectedId = kids[Math.min(authSel, kids.length - 1)]?.id;

  return (
    <View style={{ flex: 1 }}>
      {/* Шапка A4 — только back */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => setPhase("phone")}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(28, insets.bottom + 20),
          gap: 12,
        }}
      >
        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, lineHeight: 27, color: tokens.ink1 }}>
          {t.chooseChild}
        </Text>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 17, color: tokens.ink2 }}>
          {t.a4Sub}
        </Text>

        {/* Список детей — ChildPickerSheetContent (без заголовка внутри) */}
        <View style={{ marginHorizontal: -20 }}>
          <ChildPickerSheetContent
            title=""
            items={items}
            selectedId={selectedId}
            onSelect={(id) => {
              const i = kids.findIndex((k) => k.id === id);
              if (i >= 0) pickChildIndex(i);
            }}
          />
        </View>

        {/* Security-стрип — макет 2057 */}
        <GlassCard
          radius={18}
          contentStyle={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(139,92,246,0.14)",
              borderWidth: 1,
              borderColor: "rgba(139,92,246,0.35)",
            }}
          >
            <ShieldCheckIcon size={16} color="#6D28D9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>{t.a4SecurityTitle}</Text>
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink2, marginTop: 2 }}>
              {t.a4SecuritySub}
            </Text>
          </View>
        </GlassCard>

        <View style={{ height: 8 }} />
        <PrimaryButton
          label={t.continue}
          onPress={() => enterApp(Math.min(authSel, Math.max(0, kids.length - 1)))}
        />
      </ScrollView>
    </View>
  );
}

export default LoginChildPickerScreen;
