// P2 мобильный DemoBanner — жёлтая полоса сверху с иконкой + текстом +
// кнопкой «Выйти из демо». Рендерится в App.tsx над RootNavigator, чтобы
// была видна на всех экранах после демо-логина.

import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getSupabase } from "../lib/supabase";
import { useAppLocale } from "../i18n";
import { useDemoSession } from "../context/DemoSessionContext";

const YELLOW_BG = "#FEF3C7";
const YELLOW_BORDER = "#F59E0B";
const YELLOW_TEXT = "#92400E";
const LOGOUT_BG = "#78350F";
const LOGOUT_TEXT = "#FEF3C7";

/**
 * Возвращает null если сейчас НЕ в демо-режиме, иначе рендерит sticky-полосу.
 * onLoggedOut — колбек RootNavigator, чтобы вернуть пользователя на LoginScreen
 * после signOut.
 */
export function DemoBanner({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const { d } = useAppLocale();
  const { isDemo, clearDemoSession } = useDemoSession();

  if (!isDemo) return null;

  async function handleLogout() {
    await clearDemoSession();
    try {
      await getSupabase().auth.signOut({ scope: "local" });
    } catch (e) {
      console.error("[DemoBanner] signOut failed:", e);
    }
    onLoggedOut?.();
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: YELLOW_BG,
        borderBottomWidth: 1,
        borderBottomColor: YELLOW_BORDER,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        <Ionicons name="alert-circle-outline" size={16} color={YELLOW_TEXT} />
        <Text style={{ color: YELLOW_TEXT, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={2}>
          {d.demoMode.bannerText}
        </Text>
      </View>
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => ({
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          backgroundColor: LOGOUT_BG,
          opacity: pressed ? 0.85 : 1,
          marginLeft: 8,
        })}
      >
        <Text style={{ color: LOGOUT_TEXT, fontSize: 12, fontWeight: "600" }}>
          {d.demoMode.bannerLogout}
        </Text>
      </Pressable>
    </View>
  );
}
