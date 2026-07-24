/**
 * Главный стек v2: маршрут Tabs (таб-навигатор с p5/p10/p17/d24/dhub) +
 * все остальные 59 маршрутов прототипа (см. screens-map.md) — итого 64
 * экрана.
 *
 * Заход 5 — REGISTER: 15 study-экранов (d6/d7/d8/d9/d11/d12/d13/d14/d15/d16/
 * dallsubj/drev/dtopics/dteach/dmeals) подменяют StubScreen реальными
 * компонентами из src/screens/study. Остальные 44 маршрута продолжают
 * рендерить StubScreen — их закроют следующие заходы.
 *
 * Sheets (DatePickerSheet, SubmitWorkSheet) в стек НЕ регистрируются:
 * они открываются как локальные BottomSheet внутри своих parent-экранов
 * (DayStatus/Schedule/Meals — DatePickerSheet, HomeworkDetail — SubmitWorkSheet).
 *
 * Переходы — стандартный slide native-stack (соответствует анимациям
 * v2in/v2back макета: въезд/выезд по X).
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StubScreen from "../screens/StubScreen";
import TabNavigator from "./TabNavigator";
import { STACK_ROUTES, type MainStackParamList, type StackRouteName } from "./routes";

// Реальные экраны Захода 5 (15 шт.).
import DayStatusScreen from "../screens/study/DayStatusScreen";
import SubjectDetailScreen from "../screens/study/SubjectDetailScreen";
import HomeworksScreen from "../screens/study/HomeworksScreen";
import HomeworkDetailScreen from "../screens/study/HomeworkDetailScreen";
import AttendanceScreen from "../screens/study/AttendanceScreen";
import ScheduleScreen from "../screens/study/ScheduleScreen";
import SkillsScreen from "../screens/study/SkillsScreen";
import EduosAssistantScreen from "../screens/study/EduosAssistantScreen";
import AllSubjectsScreen from "../screens/study/AllSubjectsScreen";
import TeacherReviewsScreen from "../screens/study/TeacherReviewsScreen";
import TopicMasteryScreen from "../screens/study/TopicMasteryScreen";
import NotificationsScreen from "../screens/study/NotificationsScreen";
import ServicesScreen from "../screens/study/ServicesScreen";
import TeacherProfileScreen from "../screens/study/TeacherProfileScreen";
import MealsScreen from "../screens/study/MealsScreen";

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Реестр реальных study-экранов Захода 5.
 * Ключ = route name (совпадает с STACK_ROUTES), значение = компонент.
 * Для всех остальных маршрутов из STACK_ROUTES остаётся StubScreen.
 */
const STUDY_SCREENS: Partial<Record<StackRouteName, React.ComponentType<any>>> = {
  d6: DayStatusScreen,
  d7: EduosAssistantScreen,
  d8: NotificationsScreen,
  d9: ServicesScreen,
  d11: SubjectDetailScreen,
  d12: HomeworksScreen,
  d13: HomeworkDetailScreen,
  d14: AttendanceScreen,
  d15: ScheduleScreen,
  d16: SkillsScreen,
  dallsubj: AllSubjectsScreen,
  drev: TeacherReviewsScreen,
  dtopics: TopicMasteryScreen,
  dteach: TeacherProfileScreen,
  dmeals: MealsScreen,
};

export default function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Tabs"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {STACK_ROUTES.map((name) => (
        <Stack.Screen key={name} name={name} component={STUDY_SCREENS[name] ?? StubScreen} />
      ))}
    </Stack.Navigator>
  );
}
