/**
 * Таб-навигатор v2 — 5 табов макета: Главная (p5) / Успехи (p10) /
 * Оплаты (p17) / Сообщения (d24) / Профиль (dhub).
 *
 * Заход 2: фирменный плавающий стеклянный таб-бар макета (строка 4231) —
 * компонент src/ui/FloatingTabBar, подключён через tabBar={...}.
 * Лейблы — из словаря d.parentApp.nav.* (реагируют на смену языка,
 * переключатель — экран «Язык и безопасность»), иконки — прежние lucide
 * (строки 2648–2652 макета),
 * бейдж «Сообщений» — из src/data (getUnreadMessageThreadsCount, макет
 * строка 2651). Данные в презентационный компонент передаёт навигатор.
 */
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CreditCard, Home, MessageCircle, TrendingUp, User } from "lucide-react-native";
import type { Dictionary } from "@snr/core";
import HomeScreen from "../screens/tabs/HomeScreen";
import ProgressScreen from "../screens/tabs/ProgressScreen";
import MessagesScreen from "../screens/tabs/MessagesScreen";
import ProfileHubScreen from "../screens/tabs/ProfileHubScreen";
import { getUnreadMessageThreadsCount } from "../data";
import { useAppLocale } from "../i18n";
import { FloatingTabBar, type FloatingTabItem } from "../ui/FloatingTabBar";
import type { TabParamList, TabRouteName } from "./routes";
import { withScreenBoundary } from "../components/ScreenErrorBoundary";
import { comingSoon } from "../screens/ComingSoonScreen";

/**
 * Обёртки считаются ОДИН раз на модуль, а не в разметке.
 * withScreenBoundary(X) внутри JSX возвращал бы новый тип компонента на
 * каждый рендер навигатора — React считал бы это другим компонентом и
 * перемонтировал экран, теряя его состояние и прокрутку.
 */
const HomeScreenTab = withScreenBoundary(HomeScreen);
const ProgressScreenTab = withScreenBoundary(ProgressScreen);
const PaymentsScreenTab = withScreenBoundary(
  comingSoon("payments", "card", ["#7c3aed", "#4f6df5"], true),
);
const MessagesScreenTab = withScreenBoundary(MessagesScreen);
const ProfileHubScreenTab = withScreenBoundary(ProfileHubScreen);


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

function renderTabBar(props: BottomTabBarProps, labels: Record<TabRouteName, string>) {
  const { state, navigation } = props;
  const unreadMessages = getUnreadMessageThreadsCount();

  const items: FloatingTabItem[] = state.routes.map((route) => {
    const name = route.name as TabRouteName;
    const Icon = TAB_ICONS[name];
    return {
      key: name,
      label: labels[name],
      // Иконка 20 stroke 1.9 — как в макете (строки 2648–2652).
      icon: (color: string) => <Icon size={20} color={color} strokeWidth={1.9} />,
      badge: name === "d24" ? unreadMessages : undefined,
    };
  });

  return (
    <FloatingTabBar
      items={items}
      activeKey={state.routes[state.index].name}
      onPress={(key) => {
        const route = state.routes.find((r) => r.name === key);
        const isFocused = state.routes[state.index].name === key;
        if (!route) return;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(key as TabRouteName);
        }
      }}
    />
  );
}

export default function TabNavigator() {
  const { d } = useAppLocale();
  const labels = tabLabels(d);

  return (
    <Tab.Navigator
      tabBar={(props) => renderTabBar(props, labels)}
      screenOptions={{
        headerShown: false,
        // Фон под табами красит сам экран (AppBackground)
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="p5" component={HomeScreenTab} />
      <Tab.Screen name="p10" component={ProgressScreenTab} />
      <Tab.Screen name="p17" component={PaymentsScreenTab} />
      <Tab.Screen name="d24" component={MessagesScreenTab} />
      <Tab.Screen name="dhub" component={ProfileHubScreenTab} />
    </Tab.Navigator>
  );
}
