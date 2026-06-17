import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import {
  Award,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Home,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { defaultLocale, getDictionary } from "@snr/core";
import { colors } from "@snr/ui-tokens";

const tabIcon =
  (Icon: LucideIcon) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon color={color as string} size={size} />
  );

export default function TabsLayout() {
  const d = getDictionary(defaultLocale);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: d.nav.home, tabBarIcon: tabIcon(Home) }} />
      <Tabs.Screen name="schedule" options={{ title: d.nav.lessons, tabBarIcon: tabIcon(CalendarDays) }} />
      <Tabs.Screen name="homework" options={{ title: d.nav.homework, tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen name="grades" options={{ title: d.nav.grades, tabBarIcon: tabIcon(Award) }} />
      <Tabs.Screen name="attendance" options={{ title: d.nav.attendance, tabBarIcon: tabIcon(CheckSquare) }} />
      <Tabs.Screen name="payments" options={{ title: d.nav.payments, tabBarIcon: tabIcon(Wallet) }} />
      <Tabs.Screen name="profile" options={{ title: d.nav.profile, tabBarIcon: tabIcon(User) }} />
    </Tabs>
  );
}
