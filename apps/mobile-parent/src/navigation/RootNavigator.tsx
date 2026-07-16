import { useEffect } from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import MainNavigator from "./MainNavigator";
import type { ParentProfile } from "../lib/auth";

type RootStackParamList = {
  Login: undefined;
  Main: { profile: ParentProfile };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
type NavProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Внутренний компонент — регистрирует в App.tsx колбек «перейти на Login»,
 * чтобы DemoBanner (живёт выше NavigationContainer) мог им воспользоваться
 * после signOut.
 */
function DemoLogoutRegistrar({ onDemoLogoutRefSet }: { onDemoLogoutRefSet?: (fn: () => void) => void }) {
  const navigation = useNavigation<NavProp>();
  useEffect(() => {
    onDemoLogoutRefSet?.(() => {
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    });
  }, [navigation, onDemoLogoutRefSet]);
  return null;
}

/** Стек Login → Main. */
export default function RootNavigator({
  initialProfile,
  onDemoLogoutRefSet,
}: {
  initialProfile: ParentProfile | null;
  onDemoLogoutRefSet?: (fn: () => void) => void;
}) {
  return (
    <NavigationContainer>
      <DemoLogoutRegistrar onDemoLogoutRefSet={onDemoLogoutRefSet} />
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
