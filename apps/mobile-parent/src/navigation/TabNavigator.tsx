import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { getUnreadThreadCount } from "@snr/core";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "../screens/HomeScreen";
import ProgressScreen from "../screens/ProgressScreen";
import PaymentsScreen from "../screens/PaymentsScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { getSupabase } from "../lib/supabase";
import { useAppLocale } from "../i18n";
import { colors } from "../theme";
import type { ParentProfile } from "../lib/auth";

// Базовая высота содержимого таб-бара (иконка+подпись+внутренние отступы)
// БЕЗ учёта нижнего safe-area inset — сам inset прибавляется отдельно ниже.
const TAB_BAR_CONTENT_HEIGHT = 58;

export type TabParamList = {
  Home: undefined;
  Progress: undefined;
  Payments: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Progress: "trophy",
  Payments: "card",
  Messages: "chatbubbles",
  Profile: "person",
};

export default function TabNavigator({
  profile,
  onLoggedOut,
}: {
  profile: ParentProfile;
  onLoggedOut: () => void;
}) {
  const { d } = useAppLocale();
  const [unread, setUnread] = useState(0);
  const insets = useSafeAreaInsets();

  // Бейдж непрочитанных на "Сообщения" — из данных (RLS: только мои треды),
  // не хардкод. Опрос раз в 30с — без realtime-подписки для первого захода.
  useEffect(() => {
    let cancelled = false;
    const db = getSupabase();
    async function poll() {
      try {
        const n = await getUnreadThreadCount(db);
        if (!cancelled) setUnread(n);
      } catch {
        // тихий пропуск опроса бейджа — не критично для функциональности,
        // но НЕ маскирует ошибки внутри самого экрана Сообщений
      }
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          borderTopColor: colors.border,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof TabParamList]} size={size ? size - 3 : 20} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" options={{ title: d.nav.home }}>
        {() => <HomeScreen profile={profile} />}
      </Tab.Screen>
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: d.parentMobile.tabProgress }} />
      <Tab.Screen name="Payments" component={PaymentsScreen} options={{ title: d.nav.payments }} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: d.nav.messages,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 9.5 },
        }}
      />
      <Tab.Screen name="Profile" options={{ title: d.nav.profile }}>
        {() => <ProfileScreen profile={profile} onLoggedOut={onLoggedOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
