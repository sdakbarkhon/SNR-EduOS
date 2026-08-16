/**
 * Главный стек v2: маршрут Tabs (таб-навигатор с p5/p10/p17/d24/dhub) +
 * все остальные 59 маршрутов прототипа (см. screens-map.md) — итого 64
 * экрана.
 *
 * Заход 5 — REGISTER: 15 study-экранов (d6/d7/d8/d9/d11/d12/d13/d14/d15/d16/
 * dallsubj/drev/dtopics/dteach/dmeals) подменяют StubScreen реальными
 * компонентами из src/screens/study.
 * Заход 6/7 — Оплаты (12) + Сообщения (4) + Профиль (5).
 * Заход 8 — родительские сервис-разделы (8): dtests/dlib/dport/dapps/dmed/
 * dtrans/dchpass/dsessions. Остальные маршруты (da1–da8, ddoc, dchpass-
 * связанные шторки help/profmenu/call и т.п.) продолжают рендерить
 * StubScreen — их закроют следующие заходы.
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
import { comingSoon } from "../screens/ComingSoonScreen";
import AboutScreen from "../screens/profile/AboutScreen";
import TabNavigator from "./TabNavigator";
import { STACK_ROUTES, type MainStackParamList, type StackRouteName } from "./routes";

// Реальные экраны Захода 5 (15 шт.).
import HomeworksScreen from "../screens/study/HomeworksScreen";
import HomeworkDetailScreen from "../screens/study/HomeworkDetailScreen";
import AttendanceScreen from "../screens/study/AttendanceScreen";
import ScheduleScreen from "../screens/study/ScheduleScreen";
import SkillsScreen from "../screens/study/SkillsScreen";
import TopicMasteryScreen from "../screens/study/TopicMasteryScreen";
import NotificationsScreen from "../screens/study/NotificationsScreen";
import ServicesScreen from "../screens/study/ServicesScreen";
import TeacherProfileScreen from "../screens/study/TeacherProfileScreen";

// Реальные экраны Захода 8 — родительские сервис-разделы (8 шт.), заменяют
// StubScreen под dtests/dlib/dport/dapps/dmed/dtrans/dchpass/dsessions.
import DiaryScreen from "../screens/study/DiaryScreen";
import TestsScreen from "../screens/study/TestsScreen";
import LibraryScreen from "../screens/study/LibraryScreen";
import ChangePasswordScreen from "../screens/profile/ChangePasswordScreen";
import ActiveSessionsScreen from "../screens/profile/ActiveSessionsScreen";

// Реальные экраны Захода 6 — Оплаты (12 шт., шторки открываются локально).

// Реальные экраны Захода 7 — Messages (4 шт., шторки открываются локально).
import AnnouncementsScreen from "../screens/messages/AnnouncementsScreen";
import AdminNewsScreen from "../screens/messages/AdminNewsScreen";

// Реальные экраны Захода 7 — Profile (5 шт., шторки открываются локально).
import ChildProfileScreen from "../screens/profile/ChildProfileScreen";
import ParentDataScreen from "../screens/profile/ParentDataScreen";
import NotifSettingsScreen from "../screens/profile/NotifSettingsScreen";
import LangSecurityScreen from "../screens/profile/LangSecurityScreen";
import { withScreenBoundary } from "../components/ScreenErrorBoundary";

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Реестр реальных study-экранов Захода 5.
 * Ключ = route name (совпадает с STACK_ROUTES), значение = компонент.
 * Для всех остальных маршрутов из STACK_ROUTES остаётся StubScreen.
 */
const STUDY_SCREENS: Partial<Record<StackRouteName, React.ComponentType<any>>> = {
  d6: comingSoon("dayStatus", "clock", ["#34d399", "#0ea5e9"]),
  d7: comingSoon("assistant", "spark", ["#8b5cf6", "#6366f1"]),
  d8: NotificationsScreen,
  d9: ServicesScreen,
  d11: comingSoon("subjectDetail", "book", ["#facc15", "#ca8a04"]),
  d12: HomeworksScreen,
  d13: HomeworkDetailScreen,
  d14: AttendanceScreen,
  d15: ScheduleScreen,
  d16: SkillsScreen,
  dallsubj: comingSoon("subjects", "book", ["#38bdf8", "#0284c7"]),
  drev: comingSoon("reviews", "star", ["#f472b6", "#db2777"]),
  dtopics: TopicMasteryScreen,
  dteach: TeacherProfileScreen,
  dmeals: comingSoon("meals", "food", ["#f472b6", "#db2777"]),
};

/**
 * Реестр реальных payment-экранов Захода 6 (12 шт.).
 * Шторки (TopUpSheet, PayMethodSheet и т.д.) в стек НЕ регистрируются —
 * открываются как локальные BottomSheet внутри своих parent-экранов.
 */
const PAYMENT_SCREENS: Partial<Record<StackRouteName, React.ComponentType<any>>> = {
  d18: comingSoon("bills", "doc", ["#fb923c", "#ef4444"]),
  d20: comingSoon("payHistory", "clock", ["#60a5fa", "#2563eb"]),
  d21: comingSoon("receipts", "doc", ["#fbbf24", "#f97316"]),
  d22: comingSoon("wallet", "wallet", ["#7c3aed", "#a855f7"]),
  d33: comingSoon("payMethods", "card", ["#a78bfa", "#7c3aed"]),
  dtop: comingSoon("topup", "plus", ["#34d399", "#059669"]),
  dwops: comingSoon("walletOps", "clock", ["#fbbf24", "#f97316"]),
  dtransfer: comingSoon("transfer", "card", ["#60a5fa", "#2563eb"]),
  dlimits: comingSoon("limits", "grid", ["#a78bfa", "#7c3aed"]),
};

/**
 * Реестр реальных messages-экранов Захода 7 (4 шт.).
 * Шторки НЕ в стеке — открываются локально из parent screens.
 */
const MESSAGE_SCREENS: Partial<Record<StackRouteName, React.ComponentType<any>>> = {
  d25: comingSoon("chat", "chat", ["#22d3ee", "#0891b2"]),
  d26: AnnouncementsScreen,
  d27: AdminNewsScreen,
  d28: comingSoon("support", "chat", ["#60a5fa", "#2563eb"]),
};

/**
 * Реестр реальных profile-экранов Захода 7 (5 шт.).
 * Шторки НЕ в стеке — открываются локально из parent screens.
 */
const PROFILE_SCREENS: Partial<Record<StackRouteName, React.ComponentType<any>>> = {
  d29: ChildProfileScreen,
  d30: ParentDataScreen,
  d31: comingSoon("documents", "doc", ["#60a5fa", "#2563eb"]),
  d32: NotifSettingsScreen,
  d34: LangSecurityScreen,
};

/**
 * Реестр реальных экранов Захода 8 — родительские сервис-разделы (8 шт.)
 * и связанные настройки безопасности. Шторки (help/profmenu/call и т.д.)
 * остаются генерической заглушкой — они не в объёме этого захода.
 */
const SERVICE_SCREENS: Partial<Record<StackRouteName, React.ComponentType<any>>> = {
  ddiary: DiaryScreen,
  dtests: TestsScreen,
  dlib: LibraryScreen,
  dport: comingSoon("portfolio", "star", ["#2dd4bf", "#0d9488"]),
  dapps: comingSoon("applications", "doc", ["#34d399", "#059669"]),
  dmed: comingSoon("medcard", "plus", ["#fb7185", "#e11d48"]),
  dtrans: comingSoon("transport", "clock", ["#fbbf24", "#f97316"]),
  dchpass: ChangePasswordScreen,
  dsessions: ActiveSessionsScreen,
  // Заход 5 (заглушки): «О приложении» — единственный маршрут-заглушка, под
  // которым нашлись настоящие данные (версия, канал, школа, родитель).
  da7: AboutScreen,
};


/**
 * Экран маршрута, уже обёрнутый в собственную границу ошибок.
 *
 * Кэш обязателен: withScreenBoundary(X) возвращает НОВЫЙ тип компонента, и
 * вызов прямо в разметке заставлял бы React перемонтировать экран на каждый
 * рендер навигатора — с потерей состояния и прокрутки. Реестр маршрутов
 * статичен, поэтому считаем по одному разу и запоминаем.
 */
const WRAPPED: Partial<Record<StackRouteName, React.ComponentType<any>>> = {};
function screenFor(name: StackRouteName): React.ComponentType<any> {
  const cached = WRAPPED[name];
  if (cached) return cached;
  const raw =
    STUDY_SCREENS[name] ??
    PAYMENT_SCREENS[name] ??
    MESSAGE_SCREENS[name] ??
    PROFILE_SCREENS[name] ??
    SERVICE_SCREENS[name] ??
    StubScreen;
  const wrapped = withScreenBoundary(raw);
  WRAPPED[name] = wrapped;
  return wrapped;
}

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
        <Stack.Screen
          key={name}
          name={name}
          component={screenFor(name)}
        />
      ))}
    </Stack.Navigator>
  );
}
