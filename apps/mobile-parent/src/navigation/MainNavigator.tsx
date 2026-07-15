import type { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import ScheduleScreen from "../screens/ScheduleScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ChildProfileScreen from "../screens/ChildProfileScreen";
import HomeworkScreen from "../screens/HomeworkScreen";
import HomeworkDetailScreen from "../screens/HomeworkDetailScreen";
import SubjectDetailScreen from "../screens/SubjectDetailScreen";
import SkillsScreen from "../screens/SkillsScreen";
import AttendanceDetailScreen from "../screens/AttendanceDetailScreen";
import TeacherReviewsScreen from "../screens/TeacherReviewsScreen";
import MessageThreadScreen from "../screens/MessageThreadScreen";
import AnnouncementsScreen from "../screens/AnnouncementsScreen";
import AnnouncementDetailScreen from "../screens/AnnouncementDetailScreen";
import SupportScreen from "../screens/SupportScreen";
import BillsScreen from "../screens/BillsScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import PaymentHistoryScreen from "../screens/PaymentHistoryScreen";
import ReceiptScreen from "../screens/ReceiptScreen";
import ChildWalletScreen from "../screens/ChildWalletScreen";
import DocumentsScreen from "../screens/DocumentsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";
import SecurityScreen from "../screens/SecurityScreen";
import DailyStatusScreen from "../screens/DailyStatusScreen";
import InsightScreen from "../screens/InsightScreen";
import AllServicesScreen from "../screens/AllServicesScreen";
import ComingSoonScreen from "../screens/ComingSoonScreen";
import { ParentDataProvider } from "../context/ParentDataContext";
import type { ParentProfile } from "../lib/auth";
import type { Bill } from "../lib/mockPaymentsData";

export type MainStackParamList = {
  Tabs: undefined;
  Schedule: undefined;
  Notifications: undefined;
  ChildProfile: { childId: string };
  Homework: undefined;
  // Промт МОБ-3 — детальные экраны, все требуют явного childId (родитель
  // мог переключить ребёнка между открытием и просмотром — не полагаемся
  // на contextual selectedChildId внутри самих детальных экранов).
  HomeworkDetail: { id: string; childId: string };
  SubjectDetail: { subjectId: string; childId: string };
  Skills: { childId: string };
  AttendanceDetail: { childId: string };
  TeacherReviews: { childId: string };
  // Промт МОБ-4 — сообщения/объявления/поддержка.
  MessageThread: { threadId: string };
  Announcements: undefined;
  AnnouncementDetail: { id: string };
  Support: undefined;
  Bills: undefined;
  Checkout: { bill: Bill };
  PaymentHistory: undefined;
  Receipt: { recordId: string };
  ChildWallet: undefined;
  Documents: undefined;
  NotificationSettings: undefined;
  PaymentMethods: undefined;
  Security: undefined;
  // Промт МОБ-7 — v7/v8/v10.
  DailyStatus: undefined;
  Insight: undefined;
  AllServices: undefined;
  ComingSoon: { service: string; icon: keyof typeof Ionicons.glyphMap };
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
        <Stack.Screen name="HomeworkDetail" component={HomeworkDetailScreen} />
        <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
        <Stack.Screen name="Skills" component={SkillsScreen} />
        <Stack.Screen name="AttendanceDetail" component={AttendanceDetailScreen} />
        <Stack.Screen name="TeacherReviews" component={TeacherReviewsScreen} />
        <Stack.Screen name="MessageThread" component={MessageThreadScreen} />
        <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
        <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Bills" component={BillsScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
        <Stack.Screen name="Receipt" component={ReceiptScreen} />
        <Stack.Screen name="ChildWallet" component={ChildWalletScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
        <Stack.Screen name="Security" component={SecurityScreen} />
        <Stack.Screen name="DailyStatus" component={DailyStatusScreen} />
        <Stack.Screen name="Insight" component={InsightScreen} />
        <Stack.Screen name="AllServices" component={AllServicesScreen} />
        <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      </Stack.Navigator>
    </ParentDataProvider>
  );
}
