import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  getMyThreadSummaries,
  getParentAnnouncements,
  type ChatThreadSummary,
  type ParentAnnouncement,
  type AnnouncementCategory,
  type Dictionary,
} from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

type FilterKey = "all" | "chats" | "announcements" | "services";

/** Заголовок треда: для "direct" — имя ДРУГОГО участника (не меня). Раньше
 *  сюда хардкодили null вместо реального id текущего пользователя, из-за
 *  чего other?.full_name никогда не резолвился правильно (фильтр по
 *  user_id !== null всегда true, попадал первый участник, включая самого
 *  себя) — теперь myUserId приходит из db.auth.getUser() в фетчере ниже. */
function threadTitle(t: ChatThreadSummary, myUserId: string | null): string {
  if (t.kind === "group") return t.title ?? t.directGroupName ?? "—";
  if (t.kind === "direct") {
    const other = t.participants.find((p) => p.user_id !== myUserId);
    return other?.full_name ?? t.title ?? "—";
  }
  return t.title ?? "—";
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Иконка/цвет по category объявления — реальное поле announcements.category,
 *  не выдумка. Значение бейджа-тега в компактной строке тоже берём отсюда
 *  (реальный лейбл категории), а не статичное "Школа" из прототипа — см.
 *  отчёт по задаче: в схеме нет отдельного поля-источника для такого тега. */
function announcementCategoryMeta(
  category: AnnouncementCategory,
  d: Dictionary,
): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string } {
  switch (category) {
    case "urgent":
      return { icon: "alert-circle-outline", color: colors.danger, bg: colors.dangerBg, label: d.announcements.categoryUrgent };
    case "event":
      return { icon: "calendar-outline", color: colors.warning, bg: colors.warningBg, label: d.announcements.categoryEvent };
    case "academic":
      return { icon: "school-outline", color: colors.success, bg: colors.successBg, label: d.announcements.categoryAcademic };
    case "reminder":
      return { icon: "document-text-outline", color: colors.primary, bg: "#EFEAFF", label: d.announcements.categoryReminder };
    default:
      return { icon: "megaphone-outline", color: colors.primary, bg: "#EFEAFF", label: d.announcements.categoryGeneral };
  }
}

type MergedRow =
  | { kind: "thread"; ts: number; thread: ChatThreadSummary }
  | { kind: "announcement"; ts: number; ann: ParentAnnouncement };

type ScreenData = {
  myUserId: string | null;
  threads: ChatThreadSummary[];
  announcements: ParentAnnouncement[];
};

export default function MessagesScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const db = getSupabase();
  const [filter, setFilter] = useState<FilterKey>("all");

  // Один комбинированный фетч (текущий user id + треды + превью объявлений),
  // чтобы у экрана было ровно одно состояние загрузки/ошибки на оба источника
  // данных, как того требует конвенция useAsyncData в этом приложении.
  const screen = useAsyncData<ScreenData>(async () => {
    const [{ data: { user } }, threads, announcements] = await Promise.all([
      db.auth.getUser(),
      getMyThreadSummaries(db),
      getParentAnnouncements(db, 5),
    ]);
    return { myUserId: user?.id ?? null, threads, announcements };
  }, []);

  const myUserId = screen.data?.myUserId ?? null;
  const threads = screen.data?.threads ?? [];
  const announcements = screen.data?.announcements ?? [];
  const hasUnreadThread = threads.some((t) => t.unreadCount > 0);

  // Единая лента "Все" — треды и превью объявлений отсортированы вместе по
  // реальному времени последней активности (не блоками "сначала все чаты").
  const merged = useMemo<MergedRow[]>(() => {
    const rows: MergedRow[] = [
      ...threads.map((thread): MergedRow => ({
        kind: "thread",
        ts: new Date(thread.lastMessage?.created_at ?? thread.updated_at).getTime(),
        thread,
      })),
      ...announcements.map((ann): MergedRow => ({
        kind: "announcement",
        ts: new Date(ann.created_at).getTime(),
        ann,
      })),
    ];
    rows.sort((a, b) => b.ts - a.ts);
    return rows;
  }, [threads, announcements]);

  const visibleRows = filter === "chats" ? merged.filter((r) => r.kind === "thread") : merged;
  const showSupportRow = filter === "all";
  const isEmpty = visibleRows.length === 0 && !showSupportRow;

  function goSupport() {
    nav.navigate("Support");
  }

  function onChipPress(key: FilterKey) {
    if (key === "announcements") {
      nav.navigate("Announcements");
      return;
    }
    if (key === "services") {
      goSupport();
      return;
    }
    setFilter(key);
  }

  // Поиск по сообщениям намеренно не реализован в этом раунде — нет полноценной
  // функции, только уведомление о том, что она появится позже.
  function onSearchPress() {
    Alert.alert(d.parentMobile.msgSearchMockNotice);
  }

  // Старт нового чата тоже вне скоупа этого раунда — см. комментарий выше.
  function onComposePress() {
    Alert.alert(d.parentMobile.msgComposeMockNotice);
  }

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: d.parentMobile.filterAll },
    { key: "chats", label: d.parentMobile.msgFilterChats },
    { key: "announcements", label: d.parentMobile.msgFilterAnnouncements },
    { key: "services", label: d.parentMobile.msgFilterServices },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={screen.refreshing} onRefresh={screen.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.4 }}>{d.nav.messages}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onSearchPress}
                style={({ pressed }) => [{
                  width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                  opacity: pressed ? 0.85 : 1, ...shadow.soft,
                }]}
              >
                <Ionicons name="search-outline" size={18} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={onComposePress}
                style={({ pressed }) => [{
                  width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
                  opacity: pressed ? 0.85 : 1, ...shadow.soft,
                }]}
              >
                <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 7, marginBottom: 14 }}>
            {chips.map((c) => {
              const active = filter === c.key;
              const showDot = (c.key === "all" || c.key === "chats") && hasUnreadThread;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => onChipPress(c.key)}
                  style={({ pressed }) => [{
                    position: "relative", paddingVertical: 8, paddingHorizontal: 13, borderRadius: radii.sm,
                    backgroundColor: active ? colors.primary : "#fff",
                    borderWidth: 1, borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : colors.textPrimary }}>{c.label}</Text>
                  {showDot && (
                    <View style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger }} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {screen.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={screen.refresh} />
          ) : screen.loading ? (
            <ScreenSkeleton />
          ) : isEmpty ? (
            <EmptyState icon="chatbubbles-outline" title={d.parentMobile.messagesEmptyTitle} description={d.parentMobile.messagesEmptyDescription} />
          ) : (
            <>
              {visibleRows.map((row) =>
                row.kind === "thread" ? (
                  <ThreadRow key={`t-${row.thread.id}`} thread={row.thread} myUserId={myUserId} nav={nav} />
                ) : (
                  <AnnouncementRow key={`a-${row.ann.id}`} ann={row.ann} d={d} nav={nav} />
                ),
              )}
              {showSupportRow && <SupportRow d={d} onPress={goSupport} />}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ThreadRow({
  thread,
  myUserId,
  nav,
}: {
  thread: ChatThreadSummary;
  myUserId: string | null;
  nav: NativeStackNavigationProp<MainStackParamList>;
}) {
  const title = threadTitle(thread, myUserId);
  return (
    <Pressable
      onPress={() => nav.navigate("MessageThread", { threadId: thread.id })}
      style={({ pressed }) => [{
        backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, flexDirection: "row", gap: 11,
        marginBottom: 9, opacity: pressed ? 0.85 : 1, ...shadow.soft,
      }]}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: thread.kind === "group" ? "#EFEAFF" : colors.chipBg, alignItems: "center", justifyContent: "center" }}>
        {thread.kind === "group" ? (
          <Ionicons name="people" size={21} color={colors.primary} />
        ) : (
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textSecondary }}>{initials(title)}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{title}</Text>
        <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 2 }}>
          {thread.lastMessage?.body ?? ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {thread.lastMessage && <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textFaint }}>{fmtTime(thread.lastMessage.created_at)}</Text>}
        {thread.unreadCount > 0 && (
          <View style={{ minWidth: 19, height: 19, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
            <Text style={{ fontSize: 10.5, fontWeight: "700", color: "#fff" }}>{thread.unreadCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function AnnouncementRow({
  ann,
  d,
  nav,
}: {
  ann: ParentAnnouncement;
  d: Dictionary;
  nav: NativeStackNavigationProp<MainStackParamList>;
}) {
  const meta = announcementCategoryMeta(ann.category, d);
  return (
    <Pressable
      onPress={() => nav.navigate("AnnouncementDetail", { id: ann.id })}
      style={({ pressed }) => [{
        backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, flexDirection: "row", gap: 11,
        marginBottom: 9, opacity: pressed ? 0.85 : 1, ...shadow.soft,
      }]}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: meta.bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={meta.icon} size={21} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, minWidth: 0 }}>{ann.title}</Text>
          <Text style={{ fontSize: 8.5, fontWeight: "800", color: colors.primaryLight, backgroundColor: "#F1EBFF", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, flexShrink: 0 }}>
            {meta.label}
          </Text>
        </View>
        <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 2 }}>
          {ann.body}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textFaint }}>{fmtTime(ann.created_at)}</Text>
      </View>
    </Pressable>
  );
}

function SupportRow({ d, onPress }: { d: Dictionary; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, flexDirection: "row", gap: 11,
        marginBottom: 9, opacity: pressed ? 0.85 : 1, ...shadow.soft,
      }]}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="headset-outline" size={21} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{d.parentMobile.msgServiceSupportTitle}</Text>
        <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 2 }}>
          {d.parentMobile.msgServiceSupportDesc}
        </Text>
      </View>
    </Pressable>
  );
}
