import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getStudentById } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

type ChildProfile = Awaited<ReturnType<typeof getStudentById>>;

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function ChildProfileScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "ChildProfile">>();
  const { childId } = route.params;

  const child = useAsyncData<ChildProfile>(() => getStudentById(getSupabase(), childId), [childId]);
  const groups = child.data?.student_groups?.map((sg) => sg.groups).filter((g): g is NonNullable<typeof g> => Boolean(g)) ?? [];
  const curator = child.data?.curator ?? groups[0]?.teacher ?? null;

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
            <View style={{ width: 38 }} />
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
                <Row label={d.parentUi.classesLabel} value={groups.map((g) => g.name).join(", ") || d.common.none} last={!curator} />
                {curator && <Row label={d.parentUi.curatorLabel} value={curator.full_name} last />}
              </View>

              {curator?.phone && (
                <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 14, ...shadow.soft }}>
                  <Row label={d.parentUi.curatorPhoneLabel} value={curator.phone} last />
                </View>
              )}

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
