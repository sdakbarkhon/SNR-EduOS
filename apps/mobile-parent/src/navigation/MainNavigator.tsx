import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import ScheduleScreen from "../screens/ScheduleScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ChildProfileScreen from "../screens/ChildProfileScreen";
import HomeworkScreen from "../screens/HomeworkScreen";
import { ParentDataProvider } from "../context/ParentDataContext";
import type { ParentProfile } from "../lib/auth";

export type MainStackParamList = {
  Tabs: undefined;
  Schedule: undefined;
  Notifications: undefined;
  ChildProfile: { childId: string };
  Homework: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

/** Всё, что доступно после логина. ParentDataProvider оборачивает и табы,
 *  и стек-экраны (Расписание/Уведомления/Профиль ребёнка), чтобы у всех был
 *  один и тот же список детей/выбранный ребёнок без повторных запросов. */
export default function MainNavigator({
  profile,
  onLoggedOut,
}: {
  profile: ParentProfile;
  onLoggedOut: () => void;
}) {
  return (
    <ParentDataProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs">
          {() => <TabNavigator profile={profile} onLoggedOut={onLoggedOut} />}
        </Stack.Screen>
        <Stack.Screen name="Schedule" component={ScheduleScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="ChildProfile" component={ChildProfileScreen} />
        <Stack.Screen name="Homework" component={HomeworkScreen} />
      </Stack.Navigator>
    </ParentDataProvider>
  );
}
