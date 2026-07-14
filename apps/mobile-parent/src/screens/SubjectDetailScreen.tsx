import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { getChildSubjectDetail, formatDate, formatDateTime, format, type ChildSubjectDetail, type Dictionary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState, SkeletonBlock } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

// Общая длина дуги-спидометра "M12 58 A48 48 0 0 1 108 58" (см. прототип
// screen11_subject.html) — используется для strokeDasharray.
const ARC_LENGTH = 150.8;

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Та же пороговая логика "Отлично!/Хорошо/Неплохо/Нужно подтянуть" по
 *  среднему баллу (0..5), что и остальные экраны успеваемости — на момент
 *  написания ProgressScreen.tsx сам ещё не рендерит подпись рейтинга, это
 *  единственное место, где пороги пришлось задать явно. */
function ratingLabel(avg: number, d: Dictionary): string {
  if (avg >= 4.5) return d.parentMobile.progRatingExcellent;
  if (avg >= 3.5) return d.parentMobile.progRatingGood;
  if (avg >= 2.5) return d.parentMobile.progRatingAverage;
  return d.parentMobile.progRatingLow;
}

/** Целое число дней до старта урока, никогда не отрицательное. */
function daysUntil(iso: string): number {
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

export default function SubjectDetailScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "SubjectDetail">>();
  const { subjectId, childId } = route.params;

  const detail = useAsyncData<ChildSubjectDetail | null>(
    () => getChildSubjectDetail(getSupabase(), childId, subjectId),
    [childId, subjectId],
  );

  function goToMessages() {
    // Этот экран — прямой Stack.Screen в MainNavigator (не вложен в
    // TabNavigator, в отличие от HomeScreen), поэтому его nav УЖЕ на уровне
    // MainStack — .getParent() увёл бы на уровень выше (RootStack). React
    // Navigation резолвит уникальное имя экрана рекурсивно вглубь дерева, так
    // что просто nav.navigate("Messages") находит вложенный таб-экран.
    nav.navigate("Messages" as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            {detail.loading ? (
              <View style={{ flex: 1, alignItems: "center" }}>
                <SkeletonBlock height={18} width="45%" />
              </View>
            ) : (
              <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
                {detail.data?.subjectName ?? "—"}
              </Text>
            )}
            {/* Прототип показывает здесь иконку "избранное" — в этом скоупе у неё
                нет реального назначения, поэтому просто симметричный отступ,
                как в ChildProfileScreen. */}
            <View style={{ width: 38 }} />
          </View>

          {detail.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={detail.refresh} />
          ) : detail.loading ? (
            <ScreenSkeleton />
          ) : !detail.data ? (
            <EmptyState icon="book-outline" title={d.common.none} description={d.parentMobile.subjGradesEmpty} />
          ) : (
            <SubjectDetailContent
              s={detail.data}
              d={d}
              childId={childId}
              nav={nav}
              goToMessages={goToMessages}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SubjectDetailContent({
  s,
  d,
  childId,
  nav,
  goToMessages,
}: {
  s: ChildSubjectDetail;
  d: Dictionary;
  childId: string;
  nav: NativeStackNavigationProp<MainStackParamList>;
  goToMessages: () => void;
}) {
  const pct = Math.round(((s.average ?? 0) / 5) * 100);
  const arcLen = (pct / 100) * ARC_LENGTH;

  return (
    <>
      {s.teacherName && (
        <View
          style={{
            backgroundColor: colors.card, borderRadius: radii.lg, padding: 13,
            flexDirection: "row", alignItems: "center", gap: 11, marginBottom: spacing.md, ...shadow.soft,
          }}
        >
          {s.teacherAvatarUrl ? (
            <Image source={{ uri: s.teacherAvatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.success }}>{initials(s.teacherName)}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted }}>{d.parentMobile.subjTeacherLabel}</Text>
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: colors.textPrimary, marginTop: 1 }}>{s.teacherName}</Text>
          </View>
          <Pressable
            onPress={goToMessages}
            style={({ pressed }) => [{
              width: 36, height: 36, borderRadius: 18, backgroundColor: "#EFEAFF",
              alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1,
            }]}
          >
            <Ionicons name="chatbubbles" size={17} color={colors.primary} />
          </Pressable>
        </View>
      )}

      <LinearGradient
        colors={gradients.tealCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radii.xxl, padding: 16, marginBottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: 14 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#fff", opacity: 0.9, marginBottom: 5 }}>{d.parentMobile.subjCurrentPerfLabel}</Text>
          <Text style={{ fontSize: 33, fontWeight: "800", color: "#fff", letterSpacing: -0.5 }}>
            {s.average != null ? s.average.toFixed(1) : "—"}
            {s.average != null && <Text style={{ fontSize: 15, fontWeight: "600", opacity: 0.75 }}>/5.0</Text>}
          </Text>
          {s.average != null && (
            <Text style={{ fontSize: 11.5, fontWeight: "700", marginTop: 6, color: "#fff", opacity: 0.92 }}>{ratingLabel(s.average, d)}</Text>
          )}
        </View>
        <View style={{ width: 112 }}>
          <Svg viewBox="0 0 120 66" width={112} height={62}>
            <Path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={10} strokeLinecap="round" />
            <Path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${arcLen} ${ARC_LENGTH}`} />
          </Svg>
          <Text style={{ position: "absolute", left: 0, right: 0, bottom: 2, textAlign: "center", fontSize: 10, fontWeight: "700", color: "#fff", opacity: 0.85 }}>
            {pct}%
          </Text>
        </View>
      </LinearGradient>

      <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, marginBottom: spacing.md, ...shadow.soft }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 12 }}>{d.parentMobile.subjTopicsTitle}</Text>
        {s.topics.length === 0 ? (
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{d.parentMobile.subjTopicsEmpty}</Text>
        ) : (
          s.topics.map((t, i) => {
            const topicPct = Math.round((t.average / 5) * 100);
            return (
              <View
                key={t.topic}
                style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: i < s.topics.length - 1 ? 14 : 0 }}
              >
                <Text numberOfLines={1} style={{ width: 84, fontSize: 12.5, fontWeight: "600", color: colors.textPrimary }}>{t.topic}</Text>
                <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${Math.min(100, topicPct)}%`, borderRadius: 4, backgroundColor: s.color ?? colors.primary }} />
                </View>
                <Text style={{ width: 36, textAlign: "right", fontSize: 12.5, fontWeight: "800", color: s.color ?? colors.primary }}>{topicPct}%</Text>
              </View>
            );
          })
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 9, marginBottom: spacing.lg }}>
        {s.lastGradedHomework ? (
          <Pressable
            onPress={() => nav.navigate("HomeworkDetail", { id: s.lastGradedHomework!.id, childId })}
            style={({ pressed }) => [{ flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, opacity: pressed ? 0.85 : 1, ...shadow.soft }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.textMuted }}>{d.parentMobile.subjLastWorkTitle}</Text>
            </View>
            <Text numberOfLines={2} style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, lineHeight: 17 }}>{s.lastGradedHomework.title}</Text>
            {s.lastGradedHomework.gradedAt && (
              <Text style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 4 }}>{formatDate(s.lastGradedHomework.gradedAt)}</Text>
            )}
            {s.lastGradedHomework.grade != null && (
              <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: colors.successBg, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.success }}>{s.lastGradedHomework.grade}/5</Text>
              </View>
            )}
          </Pressable>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, ...shadow.soft }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.textMuted }}>{d.parentMobile.subjLastWorkTitle}</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{d.parentMobile.subjLastWorkEmpty}</Text>
          </View>
        )}

        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, ...shadow.soft }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.textMuted }}>{d.parentMobile.subjUpcomingTestTitle}</Text>
          </View>
          {s.upcomingQuizLesson ? (
            <>
              <Text numberOfLines={2} style={{ fontSize: 12.5, fontWeight: "700", color: colors.textPrimary, lineHeight: 17 }}>{s.upcomingQuizLesson.title}</Text>
              <Text style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 4 }}>{formatDateTime(s.upcomingQuizLesson.startsAt)}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: colors.warningBg, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.warning }}>
                  {format(d.parentMobile.subjUpcomingInDays, { n: daysUntil(s.upcomingQuizLesson.startsAt) })}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{d.parentMobile.subjUpcomingTestEmpty}</Text>
          )}
        </View>
      </View>

      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 10 }}>{d.parentMobile.subjTeacherCommentTitle}</Text>
      {s.lastTeacherComment ? (
        <View style={{ backgroundColor: "#E8F2FF", borderRadius: radii.lg, padding: 13, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 12.5, lineHeight: 19, color: "#3A5A80" }}>{s.lastTeacherComment.comment}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: "#8FAECB", marginTop: 6 }}>{formatDate(s.lastTeacherComment.gradedAt)}</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: 13, marginBottom: spacing.md, ...shadow.soft }}>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{d.parentMobile.subjTeacherCommentEmpty}</Text>
        </View>
      )}

      {/* TODO(ai-subject-recommendations) заменить на реальный AI-анализ по предмету, когда появится источник данных */}
      <LinearGradient
        colors={gradients.soft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radii.lg,
          padding: 13, marginBottom: spacing.lg, flexDirection: "row", gap: 11, alignItems: "center",
        }}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="sparkles" size={15} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "800", color: colors.primary, marginBottom: 2 }}>{d.parentMobile.subjAiRecTitle}</Text>
          <Text style={{ fontSize: 11.5, lineHeight: 16, color: colors.textSecondary }}>{d.parentMobile.subjAiRecMock}</Text>
        </View>
      </LinearGradient>

      <Pressable onPress={goToMessages} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 48, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          <Ionicons name="chatbubbles" size={17} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{d.parentMobile.insightBtnMessageTeacher}</Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}
