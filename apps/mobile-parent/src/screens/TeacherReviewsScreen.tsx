import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getChildTeacherReviews, type ChildTeacherReview } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Промт МОБ-3 — "Все отзывы": destination экрана для секции "Последние
 *  отзывы учителей" на #10 (Успехи). Не отдельный экран в прототипе — свой,
 *  упрощённый full-list вариант карточки отзыва оттуда же (аватар-инициалы,
 *  имя учителя + дата, комментарий), без окна sinceDays/limit — вся история. */
export default function TeacherReviewsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "TeacherReviews">>();
  const { childId } = route.params;

  // Ребёнок ищется в уже загруженном ParentDataContext (по childId из параметра
  // маршрута, не по selectedChildId — родитель мог переключить ребёнка между
  // открытием экрана #10 и просмотром этого списка). Доп. запрос не нужен —
  // для мини-карточки достаточно того, что уже есть в контексте.
  const { data: parentCtx } = useParentData();
  const child = parentCtx?.children.find((c) => c.id === childId) ?? null;

  const reviews = useAsyncData<ChildTeacherReview[]>(
    () => getChildTeacherReviews(getSupabase(), childId),
    [childId],
  );

  const list = reviews.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={reviews.refreshing} onRefresh={reviews.refresh} tintColor={colors.primary} />}
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
              {d.parentMobile.reviewsAllTitle}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {child && (
            <View
              style={{
                backgroundColor: colors.card, borderRadius: radii.xl, padding: 13,
                flexDirection: "row", alignItems: "center", gap: 11, marginBottom: spacing.md, ...shadow.soft,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>{initials(child.fullName)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>{child.fullName}</Text>
                {child.className && (
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginTop: 1 }}>{child.className}</Text>
                )}
              </View>
            </View>
          )}

          {reviews.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={reviews.refresh} />
          ) : reviews.loading ? (
            <ScreenSkeleton />
          ) : list.length === 0 ? (
            <EmptyState icon="chatbubble-ellipses-outline" title={d.parentMobile.reviewsAllEmpty} description={d.parentMobile.comingSoonSection} />
          ) : (
            list.map((r) => (
              <View
                key={r.id}
                style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, flexDirection: "row", gap: 11, marginBottom: 9, ...shadow.soft }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{r.teacherName ? initials(r.teacherName) : "?"}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: "700", color: colors.textPrimary }}>
                      {r.teacherName ?? d.common.none}
                    </Text>
                    <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textFaint }}>{fmtDate(r.gradedAt)}</Text>
                  </View>
                  {r.subjectName && (
                    <View
                      style={{
                        alignSelf: "flex-start", backgroundColor: (r.subjectColor ?? colors.primary) + "22",
                        borderRadius: radii.sm, paddingVertical: 3, paddingHorizontal: 8, marginTop: 5,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: r.subjectColor ?? colors.primary }}>{r.subjectName}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 12, lineHeight: 17.5, color: colors.textSecondary, marginTop: 6 }}>{r.comment}</Text>
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: "800", color: colors.primary }}>{r.grade}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
