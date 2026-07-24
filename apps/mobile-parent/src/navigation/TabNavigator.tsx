/**
 * Таб-навигатор v2 — 5 табов макета: Главная (p5) / Успехи (p10) /
 * Оплаты (p17) / Сообщения (d24) / Профиль (dhub).
 *
 * Заход 1: таб-бар ВРЕМЕННЫЙ простой (стилизован токенами: фон, активный
 * акцент) — фирменный стеклянный (пилюля с градиентом accent-grad,
 * blur 26, sh-float) придёт в Заходе 2. Лейблы — из словаря
 * d.parentApp.nav.* (реагируют на смену языка в dev-панели).
 */
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CreditCard, Home, MessageCircle, TrendingUp, User } from "lucide-react-native";
import type { Dictionary } from "@snr/core";
import StubScreen from "../screens/StubScreen";
import { useAppLocale } from "../i18n";
import { useTheme, fonts } from "../theme";
import type { TabParamList } from "./routes";

const Tab = createBottomTabNavigator<TabParamList>();

// Лейблы табов из словаря макета: nav.home / nav.grades / nav.payments / nav.messages / nav.profile
function tabLabels(d: Dictionary): Record<keyof TabParamList, string> {
  return {
    p5: d.parentApp.nav.home,
    p10: d.parentApp.nav.grades,
    p17: d.parentApp.nav.payments,
    d24: d.parentApp.nav.messages,
    dhub: d.parentApp.nav.profile,
  };
}

const TAB_ICONS = {
  p5: Home,
  p10: TrendingUp,
  p17: CreditCard,
  d24: MessageCircle,
  dhub: User,
} as const;

export default function TabNavigator() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const labels = tabLabels(d);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const Icon = TAB_ICONS[route.name];
        return {
          headerShown: false,
          tabBarActiveTintColor: tokens.accent,
          tabBarInactiveTintColor: tokens.ink3,
          tabBarLabel: labels[route.name],
          tabBarLabelStyle: { fontFamily: fonts.manrope800, fontSize: 9.5 },
          tabBarStyle: {
            backgroundColor:
              scheme === "dark" ? "rgba(22,16,56,0.96)" : "rgba(255,255,255,0.92)",
            borderTopColor: tokens.glassBorder,
          },
          tabBarIcon: ({ color }) => <Icon size={20} color={color} strokeWidth={1.9} />,
          // Фон под табами красит сам экран (AppBackground)
          sceneStyle: { backgroundColor: "transparent" },
        };
      }}
    >
      <Tab.Screen name="p5" component={StubScreen} />
      <Tab.Screen name="p10" component={StubScreen} />
      <Tab.Screen name="p17" component={StubScreen} />
      <Tab.Screen name="d24" component={StubScreen} />
      <Tab.Screen name="dhub" component={StubScreen} />
    </Tab.Navigator>
  );
}
