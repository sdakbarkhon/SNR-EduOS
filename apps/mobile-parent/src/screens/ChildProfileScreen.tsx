import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getStudentById, getGroupSubjectTeachers, getMyThreadSummaries, studentStatus, formatDate, type GroupSubjectTeacher } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { useParentData } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

type ChildProfile = Awaited<ReturnType<typeof getStudentById>>;

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

// Пол не хранится в schema (students не содержит такой колонки) — мок по
// первому имени для 6 реальных тестовых детей, с детерминированным
// fallback'ом по хэшу id для гипотетических будущих учеников вне списка.
const GENDER_BY_FIRST_NAME: Record<string, "m" | "f"> = {
  "шерзод": "m", "нодира": "f", "азиз": "m", "рустам": "m", "фаррух": "m", "малика": "f",
};
function mockGender(id: string, fullName: string): "m" | "f" {
  const firstName = fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (GENDER_BY_FIRST_NAME[firstName]) return GENDER_BY_FIRST_NAME[firstName];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "m" : "f";
}

export default function ChildProfileScreen() {
  const { d, locale } = useAppLocale();
  const db = getSupabase();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "ChildProfile">>();
  const { childId } = route.params;
  const { data: parentCtx, selectChild } = useParentData();

  const child = useAsyncData<ChildProfile>(() => getStudentById(getSupabase(), childId), [childId]);
  const groups = child.data?.student_groups?.map((sg) => sg.groups).filter((g): g is NonNullable<typeof g> => Boolean(g)) ?? [];
  const curator = child.data?.curator ?? groups[0]?.teacher ?? null;
  const primaryGroupId = groups[0]?.id ?? null;

  const subjects = useAsyncData<GroupSubjectTeacher[]>(
    () => (primaryGroupId ? getGroupSubjectTeachers(db, primaryGroupId) : Promise.resolve([])),
    [primaryGroupId],
  );

  function onSwitchChild() {
    if (!parentCtx || parentCtx.children.length <= 1) return;
    Alert.alert(
      d.parentUi.classesLabel,
      undefined,
      parentCtx.children.map((c) => ({
        text: `${c.fullName}${c.className ? ` — ${c.className}` : ""}`,
        onPress: () => {
          selectChild(c.id);
          nav.setParams({ childId: c.id });
        },
      })),
    );
  }

  async function onWriteCurator() {
    try {
      const threads = await getMyThreadSummaries(db);
      const thread = threads.find((t) => t.kind === "direct" && t.isCuratorThread && t.directStudentId === childId);
      if (thread) {
        nav.navigate("MessageThread", { threadId: thread.id });
      } else {
        Alert.alert(d.parentMobile.childProfNoThreadNotice);
      }
    } catch (e) {
      console.error("[ChildProfileScreen] onWriteCurator failed:", e);
      Alert.alert(d.parentMobile.errorGeneric);
    }
  }

  const gender = child.data ? mockGender(child.data.id, child.data.full_name) : null;
  const status = child.data ? studentStatus(child.data.status) : null;
  const statusColors: Record<string, { bg: string; color: string }> = {
    success: { bg: colors.successBg, color: colors.success },
    danger: { bg: colors.dangerBg, color: colors.danger },
    warning: { bg: colors.warningBg, color: colors.warning },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={child.refreshing} onRefresh={child.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentUi.profileTitle}</Text>
            {parentCtx && parentCtx.children.length > 1 ? (
              <Pressable
                onPress={onSwitchChild}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
              >
                <Ionicons name="swap-horizontal" size={19} color={colors.primary} />
              </Pressable>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>

          {child.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={child.refresh} />
          ) : child.loading || !child.data ? (
            <ScreenSkeleton />
          ) : (
            <>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 28, fontWeight: "800", color: colors.primary }}>{initials(child.data.full_name)}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{child.data.full_name}</Text>
                {groups[0]?.name ? <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 3 }}>{groups[0].name}</Text> : null}
                {/* TODO(child-id-format): реальный ID ученика формата SNR-YYYY-XXXXX, когда появится источник данных */}
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textFaint, marginTop: 6 }}>{d.parentMobile.childIdMock}</Text>
              </View>

              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 14, ...shadow.soft }}>
                <Row label={d.parentUi.birthDateLabel} value={child.data.birth_date ? new Date(child.data.birth_date).toLocaleDateString() : d.common.none} />
                <Row label={d.parentMobile.childProfGenderLabel} value={gender === "m" ? d.parentMobile.childProfGenderMale : d.parentMobile.childProfGenderFemale} />
                <Row label={d.parentUi.classesLabel} value={groups.map((g) => g.name).join(", ") || d.common.none} last={!curator} />
                {curator && <Row label={d.parentUi.curatorLabel} value={curator.full_name} last />}
              </View>

              {curator && (
                <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 14, ...shadow.soft }}>
                  {curator.phone && <Row label={d.parentUi.curatorPhoneLabel} value={curator.phone} />}
                  <Pressable onPress={onWriteCurator} style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>{d.parentMobile.childProfWriteCuratorBtn}</Text>
                  </Pressable>
                </View>
              )}

              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {d.parentMobile.childProfSubjectsTitle}
              </Text>
              {subjects.data && subjects.data.length > 0 ? (
                <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 14, ...shadow.soft }}>
                  {subjects.data.map((s, i) => (
                    <Pressable
                      key={s.subjectId}
                      onPress={() => nav.navigate("SubjectDetail", { subjectId: s.subjectId, childId })}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11,
                        borderBottomWidth: i < subjects.data!.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: (s.color ?? colors.primary) + "22", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="book-outline" size={16} color={s.color ?? colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{s.subjectName}</Text>
                        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{s.teacherName ?? d.common.none}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
                    </Pressable>
                  ))}
                </View>
              ) : !subjects.loading ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{d.parentMobile.childProfSubjectsEmpty}</Text>
                </View>
              ) : null}

              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {d.parentMobile.childProfStatusTitle}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 14, ...shadow.soft }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  {status && (
                    <View style={{ backgroundColor: statusColors[status.variant]?.bg ?? colors.chipBg, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 11 }}>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: statusColors[status.variant]?.color ?? colors.textPrimary }}>{d.status[status.key]}</Text>
                    </View>
                  )}
                </View>
                <Row label={d.parentMobile.childProfEnrolledLabel} value={formatDate(child.data.created_at, locale)} last />
              </View>

              <Pressable
                onPress={() => nav.navigate("AttendanceDetail", { childId })}
                style={({ pressed }) => [{
                  backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, paddingVertical: 13,
                  flexDirection: "row", alignItems: "center", gap: 11, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                }]}
              >
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                </View>
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{d.parentUi.attendanceTitle}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary, textAlign: "right", flexShrink: 1 }}>{value}</Text>
    </View>
  );
}
