import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTime } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useParentData, useSelectedChild } from "../context/ParentDataContext";
import { EduOSAssistantIcon } from "../components/EduOSAssistantIcon";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import { getJSON, setJSON } from "../lib/mockStorage";
import { callWebApi } from "../lib/webApi";
import type { MainStackParamList } from "../navigation/MainNavigator";

const CACHE_DAYS = 7;

type Insight = { title: string; body: string; category: string; sentiment: "positive" | "neutral" | "warning" };
type InsightResponse = { summary: string; insights: Insight[]; generatedAt: string; cached?: boolean; stale?: boolean };

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  attendance: "checkmark-circle-outline",
  grades: "trophy-outline",
  homework: "document-text-outline",
  progress: "trending-up-outline",
  recommendation: "bulb-outline",
};

const SENTIMENT_COLOR: Record<Insight["sentiment"], string> = {
  positive: colors.success,
  neutral: colors.primary,
  warning: colors.warning,
};
const SENTIMENT_BG: Record<Insight["sentiment"], string> = {
  positive: colors.successBg,
  neutral: "#EFEAFF",
  warning: colors.warningBg,
};

function cacheKey(childId: string): string {
  return `mob8.insight.${childId}`;
}

/** Промт МОБ-7, v8 — EduOS Assistant Insight. Кэш в secure-store (mockStorage)
 *  на 7 дней, дальше API сам проверяет свой недельный кэш в БД первым — двойная
 *  защита от лишних вызовов Gemini. */
export default function InsightScreen() {
  const { d, locale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, selectChild } = useParentData();
  const child = useSelectedChild();

  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (!child) { setLoading(false); return; }
    setError(null);
    if (!force) setLoading(true); else setRefreshing(true);

    try {
      if (!force) {
        const cached = await getJSON<InsightResponse>(cacheKey(child.id));
        if (cached && Date.now() - new Date(cached.generatedAt).getTime() < CACHE_DAYS * 86400000) {
          setInsight(cached);
          setLoading(false);
          return;
        }
      }
      const result = await callWebApi<InsightResponse>("/api/mobile/insight", { childId: child.id, locale, force });
      setInsight(result);
      await setJSON(cacheKey(child.id), result);
    } catch (e) {
      console.error("[InsightScreen] load failed:", e);
      // Fallback: показать последнее, что было в кэше, даже устаревшее.
      const stale = await getJSON<InsightResponse>(cacheKey(child.id));
      if (stale) {
        setInsight({ ...stale, stale: true });
      } else {
        setError((e as Error)?.message ?? d.parentMobile.errorGeneric);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [child, locale, d.parentMobile.errorGeneric]);

  useEffect(() => {
    setInsight(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  function onSwitchChild() {
    if (!parentCtx || parentCtx.children.length <= 1) return;
    Alert.alert(
      d.parentUi.classesLabel,
      undefined,
      parentCtx.children.map((c) => ({
        text: `${c.fullName}${c.className ? ` — ${c.className}` : ""}`,
        onPress: () => selectChild(c.id),
      })),
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <EduOSAssistantIcon size={26} />
              <Text numberOfLines={1} style={{ fontSize: 16.5, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.insightTitle}</Text>
            </View>
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

          {!child ? (
            <EmptyState icon="person-outline" title={d.parent.noChildren} description={d.parentMobile.comingSoonSection} />
          ) : error ? (
            <ErrorState message={error} retryLabel={d.common.retry} onRetry={() => load(false)} />
          ) : loading ? (
            <ScreenSkeleton />
          ) : !insight ? (
            <EmptyState icon="sparkles-outline" title={d.parentMobile.insightEmptyTitle} description={d.parentMobile.insightEmptyDesc} />
          ) : (
            <>
              <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md }}>
                {insight.stale ? `${d.parentMobile.insightStaleLabel} ` : ""}{formatDateTime(insight.generatedAt, locale)}
              </Text>

              <View style={{ backgroundColor: colors.primary, borderRadius: radii.xl, padding: 16, marginBottom: spacing.lg }}>
                <Text style={{ fontSize: 13.5, lineHeight: 19, color: "#fff", fontWeight: "600" }}>{insight.summary}</Text>
              </View>

              <View style={{ gap: 10, marginBottom: spacing.lg }}>
                {insight.insights.map((ins, i) => (
                  <View key={i} style={{ backgroundColor: colors.card, borderRadius: radii.xl, padding: 14, flexDirection: "row", gap: 12, ...shadow.soft }}>
                    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: SENTIMENT_BG[ins.sentiment] ?? colors.chipBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Ionicons name={CATEGORY_ICON[ins.category] ?? "sparkles-outline"} size={19} color={SENTIMENT_COLOR[ins.sentiment] ?? colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 }}>{ins.title}</Text>
                      <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginBottom: 8 }}>{ins.body}</Text>
                      <View style={{ backgroundColor: colors.chipBg, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, alignSelf: "flex-start" }}>
                        <Text style={{ fontSize: 9.5, fontWeight: "800", color: colors.textSecondary }}>{categoryLabel(ins.category, d)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => load(true)}
                disabled={refreshing}
                style={({ pressed }) => [{
                  backgroundColor: colors.card, borderRadius: radii.xl, paddingVertical: 13, alignItems: "center",
                  flexDirection: "row", justifyContent: "center", gap: 7, opacity: refreshing ? 0.6 : pressed ? 0.85 : 1, ...shadow.soft,
                }]}
              >
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>{d.parentMobile.insightRefreshBtn}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function categoryLabel(category: string, d: ReturnType<typeof useAppLocale>["d"]): string {
  switch (category) {
    case "attendance": return d.parentUi.attendanceTitle;
    case "grades": return d.parentUi.gradesTitle;
    case "homework": return d.parentUi.homeworkTitle;
    case "progress": return d.parentMobile.progSubjectsSectionTitle;
    default: return d.parentMobile.insightCategoryRecommendation;
  }
}
