import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAppLocale } from "../i18n";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

/** Промт МОБ-7, v10 — плоская заглушка для неактивных карточек "Все сервисы".
 *  Параметризована названием/иконкой сервиса, чтобы не плодить 6 почти
 *  одинаковых экранов под каждую заглушку. */
export default function ComingSoonScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "ComingSoon">>();
  const { service, icon } = route.params;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.lg }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
            <Ionicons name={icon} size={40} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>{service}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary, marginBottom: 10 }}>{d.parentMobile.comingSoonTitle}</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: 28 }}>
            {d.parentMobile.comingSoonDesc}
          </Text>
          <Pressable
            onPress={() => nav.goBack()}
            style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 13, paddingHorizontal: 36 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{d.common.back}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
