import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";

type Filter = "all" | "unread";

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  announcement: "megaphone-outline",
  new_homework: "document-text-outline",
  new_grade: "trophy-outline",
  homework_graded: "checkmark-circle-outline",
  lesson_material: "book-outline",
  student_excused: "calendar-outline",
  student_submitted: "cloud-upload-outline",
  leave_request: "exit-outline",
  leave_decision: "checkmark-done-outline",
  lesson_starting_soon: "time-outline",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
}
function isYesterday(iso: string): boolean {
  const y = new Date(Date.now() + 5 * 3600000 - 86400000).toISOString().slice(0, 10);
  return iso.slice(0, 10) === y;
}

export default function NotificationsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation();
  const [filter, setFilter] = useState<Filter>("all");
  const db = getSupabase();

  const notif = useAsyncData<AppNotification[]>(() => getMyNotifications(db, 50), []);

  const list = useMemo(() => {
    const rows = notif.data ?? [];
    return filter === "unread" ? rows.filter((n) => !n.is_read) : rows;
  }, [notif.data, filter]);

  const today = list.filter((n) => isToday(n.created_at));
  const yesterday = list.filter((n) => isYesterday(n.created_at));
  const older = list.filter((n) => !isToday(n.created_at) && !isYesterday(n.created_at));

  const onPressItem = useCallback(async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(db, n.id);
        notif.refresh();
      } catch {
        // не блокируем UI на ошибке пометки прочитанным — не критично
      }
    }
  }, [db, notif]);

  async function onMarkAll() {
    try {
      await markAllNotificationsRead(db);
      notif.refresh();
    } catch {
      // тихо — следующий refresh/pull-to-refresh покажет актуальное состояние
    }
  }

  function renderGroup(title: string | null, rows: AppNotification[]) {
    if (rows.length === 0) return null;
    return (
      <View style={{ marginBottom: 6 }}>
        {title ? (
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</Text>
        ) : null}
        {rows.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => onPressItem(n)}
            style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, flexDirection: "row", gap: 11, marginBottom: 9, ...shadow.soft }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={KIND_ICON[n.kind] ?? "notifications-outline"} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.textPrimary }} numberOfLines={1}>{n.title}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textFaint }}>{fmtTime(n.created_at)}</Text>
              </View>
              {n.body ? <Text numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 16, color: colors.textSecondary, marginTop: 3 }}>{n.body}</Text> : null}
            </View>
            {!n.is_read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, alignSelf: "center" }} />}
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={notif.refreshing} onRefresh={notif.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.textPrimary }}>{d.notifications.title}</Text>
            <Pressable
              onPress={onMarkAll}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="checkmark-done" size={19} color={colors.primary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 7, marginBottom: 16 }}>
            {(["all", "unread"] as Filter[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={{
                  paddingVertical: 8, paddingHorizontal: 13, borderRadius: radii.sm,
                  backgroundColor: filter === key ? colors.primary : "#fff",
                  borderWidth: 1, borderColor: filter === key ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: filter === key ? "#fff" : colors.textPrimary }}>
                  {key === "all" ? d.parentMobile.filterAll : d.parentMobile.filterUnread}
                </Text>
              </Pressable>
            ))}
          </View>

          {notif.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={notif.refresh} />
          ) : notif.loading ? (
            <ScreenSkeleton />
          ) : list.length === 0 ? (
            <EmptyState icon="notifications-off-outline" iconColor={colors.success} iconBg={colors.successBg} title={d.notifications.empty} description={d.parentMobile.comingSoonSection} />
          ) : (
            <>
              {renderGroup(d.notifications.today, today)}
              {renderGroup(d.notifications.yesterday, yesterday)}
              {renderGroup(d.common.none, older)}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
