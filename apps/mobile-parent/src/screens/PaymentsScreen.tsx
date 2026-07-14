import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppLocale } from "../i18n";
import { colors, radii, spacing } from "../theme";

/** Оплаты — placeholder-экран (Промт МОБ-1, Часть 1). Реальные getPayments/
 *  getCharges из @snr/core подключаются во втором заходе вместе с полным
 *  UI истории платежей; пока — те же MOCK-плашки балансов, что и на
 *  Главной. TODO(payments): заменить на реальные данные. */
export default function PaymentsScreen() {
  const { d } = useAppLocale();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 }}>{d.nav.payments}</Text>

          <View style={{ gap: 10, marginBottom: 24 }}>
            <View style={{ borderRadius: radii.xl, padding: 15, backgroundColor: colors.accentCoral, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 4 }}>{d.parentMobile.balanceMealTitle}</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>{`80 000 ${d.parentMobile.sumCurrency}`}</Text>
              </View>
              <Ionicons name="restaurant-outline" size={26} color="#fff" />
            </View>
            <View style={{ borderRadius: radii.xl, padding: 15, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 4 }}>{d.parentMobile.balanceAccountTitle}</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>{`120 000 ${d.parentMobile.sumCurrency}`}</Text>
              </View>
              <Ionicons name="wallet-outline" size={26} color="#fff" />
            </View>
          </View>

          <View style={{ alignItems: "center", paddingTop: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="construct-outline" size={30} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>{d.parentMobile.comingSoonSection}</Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 20, lineHeight: 18 }}>
              {d.parentUi.remainingBalance}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
