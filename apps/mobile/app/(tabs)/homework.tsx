import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Clock } from "lucide-react-native";
import {
  deadlineUrgency,
  defaultLocale,
  getDictionary,
  getHomeworkWithSubmissions,
  getSubjectStyle,
  homeworkCategory,
  homeworkCounts,
  type HomeworkTab,
  type HomeworkWithSubmission,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { Screen, SegmentedTabs, SubjectIcon, type TabItem } from "../../components";
import { getSupabase } from "../../lib/supabase";

const d = getDictionary(defaultLocale);
const sb = getSupabase();

const TABS: { key: HomeworkTab; label: string }[] = [
  { key: "active", label: d.homework.active },
  { key: "review", label: d.homework.onReview },
  { key: "completed", label: d.homework.done },
  { key: "overdue", label: d.homework.overdue },
];

const EMPTY_MESSAGES: Record<HomeworkTab, string> = {
  active: d.homework.emptyActive,
  review: d.homework.emptyReview,
  completed: d.homework.emptyCompleted,
  overdue: d.homework.emptyOverdue,
};

function DeadlinePill({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const urgency = deadlineUrgency(dueDate);
  const date = new Date(dueDate).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
  const bg =
    urgency === "overdue" ? "#FEE2E2" : urgency === "soon" ? "#FEF3C7" : "#F1F5F9";
  const fg =
    urgency === "overdue" ? "#DC2626" : urgency === "soon" ? "#D97706" : "#64748B";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Clock size={11} color={fg} />
      <Text style={{ fontSize: 11, color: fg, fontWeight: "500" }}>
        {d.homework.due.replace("{date}", date)}
      </Text>
    </View>
  );
}

function HomeworkListCard({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const subj = hw.group.subject;
  const style = getSubjectStyle(subj);
  const tab = homeworkCategory(hw, hw.submission);
  const statusLabel =
    tab === "review"
      ? d.homework.onReview
      : tab === "completed"
        ? d.homework.done
        : tab === "overdue"
          ? d.homework.overdue
          : null;

  return (
    <Pressable
      onPress={() => router.push(`/homework/${hw.id}` as never)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        backgroundColor: pressed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.7)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        padding: 14,
        marginBottom: 10,
      })}
    >
      <SubjectIcon subject={subj} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: colors.textMuted,
            }}
          >
            {subj}
          </Text>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              backgroundColor: hw.content_type === "test" ? "#EDE9FE" : "#DBEAFE",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: hw.content_type === "test" ? "#6D28D9" : "#1D4ED8",
              }}
            >
              {hw.content_type === "test" ? d.homework.typeTest : d.homework.typeFile}
            </Text>
          </View>
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.textPrimary,
            marginBottom: 6,
          }}
          numberOfLines={2}
        >
          {hw.title}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <DeadlinePill dueDate={hw.due_date} />
          {statusLabel && (
            <View
              style={{
                backgroundColor: `${style.color}1A`,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 11, color: style.color, fontWeight: "500" }}>
                {statusLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
      <ChevronRight size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
    </Pressable>
  );
}

export default function HomeworkScreen() {
  const [rows, setRows] = useState<HomeworkWithSubmission[]>([]);
  const [tab, setTab] = useState<HomeworkTab>("active");
  const [loading, setLoading] = useState(true);

  const counts = useMemo(() => homeworkCounts(rows), [rows]);

  const filtered = useMemo(
    () => rows.filter((r) => homeworkCategory(r, r.submission) === tab),
    [rows, tab],
  );

  const load = useCallback(async () => {
    try {
      const data = await getHomeworkWithSubmissions(sb);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const channel = sb
      .channel("hw-list-mobile")
      .on("postgres_changes", { event: "*", schema: "public", table: "homework" }, load)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "homework_submissions" },
        load,
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [load]);

  const tabItems: TabItem[] = TABS.map((t) => ({
    key: t.key,
    label: `${t.label}${counts[t.key] > 0 ? ` (${counts[t.key]})` : ""}`,
  }));

  return (
    <Screen title={d.homework.title} scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          <SegmentedTabs tabs={tabItems} value={tab} onChange={(k) => setTab(k as HomeworkTab)} />
        </ScrollView>

        {loading ? (
          <Text style={{ textAlign: "center", color: colors.textMuted, paddingVertical: 48 }}>
            {d.common.loading}
          </Text>
        ) : filtered.length === 0 ? (
          <Text
            style={{
              textAlign: "center",
              color: colors.textMuted,
              fontSize: 14,
              paddingVertical: 48,
            }}
          >
            {EMPTY_MESSAGES[tab]}
          </Text>
        ) : (
          filtered.map((hw) => <HomeworkListCard key={hw.id} hw={hw} />)
        )}
      </ScrollView>
    </Screen>
  );
}
