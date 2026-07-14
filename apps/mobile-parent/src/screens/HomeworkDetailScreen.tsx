import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getChildHomeworkDetail, formatDateTime, type ChildHomeworkDetail, type Dictionary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** 4 узла статус-степпера. test_submissions не имеет колонки `status` (см.
 *  packages/core/src/types.ts — TestSubmission: id/homework_id/student_id/
 *  submitted_at/score/max_score/started_at/grade, без status и без
 *  teacher_comment) — поэтому для теста review/graded выводится из
 *  наличия grade, а не из отдельного статуса. */
type StepKey = "assigned" | "inProgress" | "review" | "graded";
const STEP_ORDER: StepKey[] = ["assigned", "inProgress", "review", "graded"];

function deriveStepKey(hw: ChildHomeworkDetail): StepKey {
  if (hw.submission) {
    if (hw.submission.status === "graded") return "graded";
    if (hw.submission.status === "submitted" || hw.submission.status === "checking") return "review";
    return "inProgress";
  }
  if (hw.test_submission) {
    return hw.test_submission.grade != null ? "graded" : "review";
  }
  return "assigned";
}

function stepLabels(d: Dictionary): Record<StepKey, string> {
  return {
    assigned: d.parentMobile.hwDetailStepAssigned,
    inProgress: d.parentMobile.hwDetailStepInProgress,
    review: d.parentMobile.hwDetailStepReview,
    graded: d.parentMobile.hwDetailStepGraded,
  };
}

const STATUS_STYLE: Record<StepKey, { color: string; bg: string }> = {
  assigned: { color: colors.textSecondary, bg: colors.chipBg },
  inProgress: { color: colors.warning, bg: colors.warningBg },
  review: { color: colors.primary, bg: "#EFEAFF" },
  graded: { color: colors.success, bg: colors.successBg },
};

/** Расширение из имени файла для бейджа вложения — HomeworkAttachment
 *  (packages/core/src/types.ts) хранит только {name, url}, размера файла
 *  в типе нет, поэтому строку "PDF · 1.2 МБ" из прототипа показать нельзя —
 *  выводим только тип файла и имя. */
function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

export default function HomeworkDetailScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "HomeworkDetail">>();
  const { id, childId } = route.params;

  const { data: parentCtx, loading: parentLoading, error: parentError, refresh: refreshParent } = useParentData();
  const child = parentCtx?.children.find((c) => c.id === childId) ?? null;

  const hw = useAsyncData<ChildHomeworkDetail | null>(
    () => getChildHomeworkDetail(getSupabase(), childId, id),
    [childId, id],
  );

  const loading = parentLoading || hw.loading;
  const error = parentError ?? hw.error;

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
          refreshControl={
            <RefreshControl
              refreshing={parentCtx != null && (parentLoading || hw.refreshing)}
              onRefresh={() => {
                refreshParent();
                hw.refresh();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
              {d.parentMobile.hwDetailTitle}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {error ? (
            <ErrorState
              message={d.parentMobile.errorGeneric}
              retryLabel={d.common.retry}
              onRetry={() => {
                refreshParent();
                hw.refresh();
              }}
            />
          ) : loading ? (
            <ScreenSkeleton />
          ) : !child ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : !hw.data ? (
            <EmptyState icon="document-text-outline" title={d.parentMobile.hwDetailNotFound} description={d.parentMobile.comingSoonSection} />
          ) : (
            <HomeworkDetailContent hw={hw.data} child={child} d={d} nav={nav} goToMessages={goToMessages} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HomeworkDetailContent({
  hw,
  child,
  d,
  nav,
  goToMessages,
}: {
  hw: ChildHomeworkDetail;
  child: { id: string; fullName: string; className: string | null };
  d: Dictionary;
  nav: NativeStackNavigationProp<MainStackParamList>;
  goToMessages: () => void;
}) {
  const stepKey = deriveStepKey(hw);
  const labels = stepLabels(d);
  const statusStyle = STATUS_STYLE[stepKey];
  const currentIndex = STEP_ORDER.indexOf(stepKey);
  // "graded" закрывает всю дорожку — все 4 узла отмечены как выполненные.
  const allDone = stepKey === "graded";

  // teacher_comment есть только на HomeworkSubmission (файловые/кодовые/bundle
  // задания) — у TestSubmission такого поля нет вовсе (см. types.ts), поэтому
  // для тестовых заданий комментарий учителя всегда пуст (известное ограничение).
  const teacherComment = hw.submission?.teacher_comment ?? null;
  const commentDate = hw.submission?.submitted_at ?? null;

  return (
    <>
      {/* Мини-карточка ребёнка */}
      <View
        style={{
          backgroundColor: colors.card, borderRadius: radii.lg, paddingVertical: 10, paddingHorizontal: 13,
          flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, ...shadow.soft,
        }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary, letterSpacing: 0.3 }}>{initials(child.fullName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{child.fullName}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginTop: 1 }}>{child.className ?? d.common.none}</Text>
        </View>
      </View>

      {/* Карточка-сводка задания */}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, marginBottom: 10, ...shadow.card }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <View
            style={{
              width: 42, height: 42, borderRadius: 13, backgroundColor: (hw.subjectColor ?? colors.primary) + "22",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="document-text-outline" size={21} color={hw.subjectColor ?? colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted }}>{hw.subjectName ?? hw.group.subject}</Text>
            <Text style={{ fontSize: 16.5, fontWeight: "800", color: colors.textPrimary, marginTop: 1, letterSpacing: -0.2 }}>{hw.title}</Text>
          </View>
          <Text
            style={{
              fontSize: 10.5, fontWeight: "700", color: statusStyle.color, backgroundColor: statusStyle.bg,
              borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9, flexShrink: 0,
            }}
          >
            {labels[stepKey]}
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 }}>
              <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textMuted }}>{d.parentMobile.hwDetailDeadlineLabel}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "800", color: hw.due_date ? colors.danger : colors.textPrimary }}>
              {hw.due_date ? formatDateTime(hw.due_date) : d.parentMobile.hwDetailNoDeadline}
            </Text>
          </View>
          <View style={{ flex: 1.2, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Text style={{ fontSize: 10.5, fontWeight: "800", color: colors.success }}>{hw.teacherName ? initials(hw.teacherName) : "—"}</Text>
            </View>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textMuted }}>{d.parentMobile.subjTeacherLabel}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>{hw.teacherName ?? d.common.none}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Инструкция + вложения */}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, marginBottom: 10, ...shadow.card }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary, marginBottom: 7 }}>{d.parentMobile.hwDetailInstructionsTitle}</Text>
        {hw.description ? (
          <Text style={{ fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{hw.description}</Text>
        ) : null}

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary, marginTop: hw.description ? 13 : 0, marginBottom: 8 }}>
          {d.parentMobile.hwDetailAttachmentsTitle}
        </Text>
        {hw.attachments.length === 0 ? (
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{d.parentMobile.hwDetailNoAttachments}</Text>
        ) : (
          hw.attachments.map((att, i) => (
            <View
              key={`${att.url}-${i}`}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgAlt,
                borderRadius: 13, padding: 10, marginBottom: i < hw.attachments.length - 1 ? 8 : 0,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Text style={{ fontSize: 8.5, fontWeight: "800", color: colors.danger }}>{fileExt(att.name)}</Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: "700", color: colors.textPrimary, minWidth: 0 }}>{att.name}</Text>
              <Pressable
                onPress={() => Linking.openURL(att.url)}
                style={({ pressed }) => [{
                  borderWidth: 1.5, borderColor: colors.borderAlt, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10,
                  opacity: pressed ? 0.85 : 1, flexShrink: 0,
                }]}
              >
                <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.primary }}>{d.parentMobile.hwDetailOpenFileBtn}</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Статус-степпер */}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, marginBottom: 10, ...shadow.card }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary, marginBottom: 14 }}>{d.parentMobile.hwDetailStatusTitle}</Text>
        <View style={{ flexDirection: "row" }}>
          {STEP_ORDER.map((key, i) => {
            const isDone = allDone || i < currentIndex;
            const isCurrent = !allDone && i === currentIndex;
            return (
              <View key={key} style={{ flex: 1, alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? "transparent" : colors.border }} />
                  {isDone ? (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </View>
                  ) : isCurrent ? (
                    <LinearGradient
                      colors={gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
                    </LinearGradient>
                  ) : (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.border }} />
                  )}
                  <View style={{ flex: 1, height: 2, backgroundColor: i === STEP_ORDER.length - 1 ? "transparent" : colors.border }} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textPrimary, marginTop: 7, textAlign: "center" }}>{labels[key]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Комментарий учителя */}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 15, marginBottom: 14, ...shadow.card }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary, marginBottom: 9 }}>{d.parentMobile.subjTeacherCommentTitle}</Text>
        {teacherComment ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.success }}>{hw.teacherName ? initials(hw.teacherName) : "—"}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.bgAlt, borderRadius: 13, padding: 11 }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textPrimary }}>{teacherComment}</Text>
              {/* На HomeworkSubmission нет отдельного graded_at — показываем submitted_at
                  (известное ограничение общего типа, см. types.ts). */}
              {commentDate && (
                <Text style={{ fontSize: 9.5, fontWeight: "600", color: colors.textFaint, marginTop: 5 }}>{formatDateTime(commentDate)}</Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{d.parentMobile.hwDetailTeacherCommentEmpty}</Text>
        )}
      </View>

      {/* Действия */}
      <Pressable onPress={goToMessages} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginBottom: 9 }]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 46, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          <Ionicons name="chatbubbles" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>{d.parentMobile.insightBtnMessageTeacher}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        // TODO(homework-file-upload): real upload flow
        onPress={() =>
          Alert.alert(d.parentMobile.hwDetailSubmitUpdatedBtn, d.parentMobile.hwDetailSubmitMockNotice)
        }
        style={({ pressed }) => [{
          height: 46, borderRadius: radii.lg, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.borderAlt,
          alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1,
        }]}
      >
        <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13.5, fontWeight: "700" }}>{d.parentMobile.hwDetailSubmitUpdatedBtn}</Text>
      </Pressable>
    </>
  );
}
