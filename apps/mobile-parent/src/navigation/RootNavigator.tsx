import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import MainNavigator from "./MainNavigator";
import type { ParentProfile } from "../lib/auth";

type RootStackParamList = {
  Login: undefined;
  Main: { profile: ParentProfile };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Стек Login → Main (табы + стек-экраны внутри). Оба верхнеуровневых
 *  экрана рисуют собственный header/topbar, нативный header скрыт. */
export default function RootNavigator({
  initialProfile,
}: {
  initialProfile: ParentProfile | null;
}) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialProfile ? "Main" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login">
          {({ navigation }) => (
            <LoginScreen
              onLoggedIn={(profile) => navigation.replace("Main", { profile })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Main"
          initialParams={initialProfile ? { profile: initialProfile } : undefined}
        >
          {({ navigation, route }) => (
            <MainNavigator
              profile={route.params.profile}
              onLoggedOut={() => navigation.replace("Login")}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
