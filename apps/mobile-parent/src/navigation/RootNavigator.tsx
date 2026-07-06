import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import type { ParentProfile } from "../lib/auth";

type RootStackParamList = {
  Login: undefined;
  Dashboard: { profile: ParentProfile };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Стек Login → Dashboard. Оба экрана рисуют собственный header/topbar,
 *  поэтому нативный header навигатора всегда скрыт. */
export default function RootNavigator({
  initialProfile,
}: {
  initialProfile: ParentProfile | null;
}) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialProfile ? "Dashboard" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login">
          {({ navigation }) => (
            <LoginScreen
              onLoggedIn={(profile) => navigation.replace("Dashboard", { profile })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Dashboard"
          initialParams={initialProfile ? { profile: initialProfile } : undefined}
        >
          {({ navigation, route }) => (
            <DashboardScreen
              profile={route.params.profile}
              onLoggedOut={() => navigation.replace("Login")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
