import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getMyThreadSummaries, type ChatThreadSummary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";

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

export default function MessagesScreen() {
  const { d } = useAppLocale();
  const db = getSupabase();
  const threads = useAsyncData<ChatThreadSummary[]>(() => getMyThreadSummaries(db), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={threads.refreshing} onRefresh={threads.refresh} tintColor={colors.primary} />}
        >
          <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, marginBottom: 14 }}>{d.nav.messages}</Text>

          {threads.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={threads.refresh} />
          ) : threads.loading ? (
            <ScreenSkeleton />
          ) : (threads.data ?? []).length === 0 ? (
            <EmptyState icon="chatbubbles-outline" title={d.parentMobile.messagesEmptyTitle} description={d.parentMobile.messagesEmptyDescription} />
          ) : (
            threads.data!.map((t) => {
              const title = threadTitle(t, null);
              return (
                <Pressable
                  key={t.id}
                  style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 12, flexDirection: "row", gap: 11, marginBottom: 9, ...shadow.soft }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.kind === "group" ? "#EFEAFF" : colors.chipBg, alignItems: "center", justifyContent: "center" }}>
                    {t.kind === "group" ? (
                      <Ionicons name="people" size={21} color={colors.primary} />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textSecondary }}>{initials(title)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{title}</Text>
                    <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 2 }}>
                      {t.lastMessage?.body ?? ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    {t.lastMessage && <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textFaint }}>{fmtTime(t.lastMessage.created_at)}</Text>}
                    {t.unreadCount > 0 && (
                      <View style={{ minWidth: 19, height: 19, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: "700", color: "#fff" }}>{t.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
