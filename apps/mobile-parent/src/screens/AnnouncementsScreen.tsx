import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getParentAnnouncements, formatDate, type ParentAnnouncement, type AnnouncementCategory, type Dictionary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

// TODO(announcement-engagement): the prototype (screen26_announcements.html)
// shows view/comment counters on each card, but the schema has no
// announcement_likes/announcement_comments tables and no count columns on
// `announcements` (confirmed by a live read-only audit) — that row is
// intentionally omitted below rather than faked with zeros.

type Filter = "all" | "urgent" | "academic" | "event" | "reminder";

type CategoryMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  gradient: readonly [string, string] | readonly [string, string, string];
};

// Category IS the importance signal in this schema (no separate priority
// field) — one accent color per category, reused for the tag pill, the hero
// icon, and (for "urgent") the extra important-badge below.
const CATEGORY_META: Record<AnnouncementCategory, CategoryMeta> = {
  general: { icon: "megaphone-outline", color: colors.primary, gradient: gradients.primary },
  academic: { icon: "book-outline", color: colors.success, gradient: gradients.tealCard },
  event: { icon: "calendar-outline", color: colors.accentOrange, gradient: gradients.warmCard },
  urgent: { icon: "alert-circle-outline", color: colors.danger, gradient: [colors.danger, colors.accentCoral] },
  reminder: { icon: "notifications-outline", color: colors.accentCoral, gradient: [colors.primaryLight, colors.accentCoral] },
};

function categoryLabel(cat: AnnouncementCategory, d: Dictionary): string {
  switch (cat) {
    case "academic": return d.announcements.categoryAcademic;
    case "event": return d.announcements.categoryEvent;
    case "urgent": return d.announcements.categoryUrgent;
    case "reminder": return d.announcements.categoryReminder;
    default: return d.announcements.categoryGeneral;
  }
}

export default function AnnouncementsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const db = getSupabase();
  const [filter, setFilter] = useState<Filter>("all");

  const ann = useAsyncData<ParentAnnouncement[]>(() => getParentAnnouncements(db), []);
  const list = ann.data ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? list : list.filter((a) => a.category === filter)),
    [list, filter],
  );

  const chips: Array<{ key: Filter; label: string; color: string }> = [
    { key: "all", label: d.parentMobile.filterAll, color: colors.primary },
    { key: "urgent", label: d.announcements.categoryUrgent, color: CATEGORY_META.urgent.color },
    { key: "academic", label: d.announcements.categoryAcademic, color: CATEGORY_META.academic.color },
    { key: "event", label: d.announcements.categoryEvent, color: CATEGORY_META.event.color },
    { key: "reminder", label: d.announcements.categoryReminder, color: CATEGORY_META.reminder.color },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={ann.refreshing} onRefresh={ann.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => [{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff",
                alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...shadow.soft,
              }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
              {d.parentMobile.annListTitle}
            </Text>
            {/* Правый спейсер держит заголовок по центру — отдельного
                сортировки/меню-функционала для этого экрана не заявлено. */}
            <View style={{ width: 38 }} />
          </View>

          {ann.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={ann.refresh} />
          ) : ann.loading ? (
            <ScreenSkeleton />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7, marginBottom: 14 }}
              >
                {chips.map((c) => {
                  const active = filter === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setFilter(c.key)}
                      style={({ pressed }) => [{
                        paddingVertical: 8, paddingHorizontal: 13, borderRadius: 11,
                        backgroundColor: active ? c.color : c.color + "14",
                        borderWidth: 1, borderColor: active ? c.color : c.color + "33",
                        opacity: pressed ? 0.85 : 1,
                      }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : c.color }}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {filtered.length === 0 ? (
                <EmptyState icon="megaphone-outline" title={d.announcements.empty} description={d.parentMobile.comingSoonSection} />
              ) : (
                filtered.map((a) => {
                  const meta = CATEGORY_META[a.category];
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => nav.navigate("AnnouncementDetail", { id: a.id })}
                      style={({ pressed }) => [{
                        backgroundColor: colors.card, borderRadius: radii.xl, overflow: "hidden",
                        marginBottom: 12, opacity: pressed ? 0.97 : 1, ...shadow.soft,
                      }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 9 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                          <Text
                            style={{
                              fontSize: 10, fontWeight: "800", color: meta.color, backgroundColor: meta.color + "1E",
                              borderRadius: 7, paddingVertical: 4, paddingHorizontal: 9,
                            }}
                          >
                            {categoryLabel(a.category, d)}
                          </Text>
                          {a.category === "urgent" && (
                            <Text
                              style={{
                                fontSize: 10, fontWeight: "800", color: "#fff", backgroundColor: colors.danger,
                                borderRadius: 7, paddingVertical: 4, paddingHorizontal: 9,
                              }}
                            >
                              {d.parentMobile.annImportantBadge}
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textFaint, flexShrink: 0 }}>
                          {formatDate(a.created_at)}
                        </Text>
                      </View>

                      <View style={{ marginHorizontal: 14, height: 110, borderRadius: 13, overflow: "hidden" }}>
                        <LinearGradient
                          colors={meta.gradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                        >
                          <View
                            style={{
                              width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.78)",
                              alignItems: "center", justifyContent: "center", ...shadow.soft,
                            }}
                          >
                            <Ionicons name={meta.icon} size={25} color={meta.color} />
                          </View>
                        </LinearGradient>
                      </View>

                      <View style={{ padding: 14 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {a.is_pinned && <Ionicons name="pin" size={13} color={colors.primary} />}
                          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 }}>
                            {a.title}
                          </Text>
                        </View>
                        <Text numberOfLines={3} style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }}>
                          {a.body}
                        </Text>
                        {a.valid_until && (
                          <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginTop: 6 }}>
                            {d.announcements.validUntil.replace("{date}", formatDate(a.valid_until))}
                          </Text>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted }}>
                            {a.isFromAdmin ? d.parentMobile.annSourceAdmin : a.authorName ?? d.common.none}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
