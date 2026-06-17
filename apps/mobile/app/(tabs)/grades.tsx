import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  defaultLocale,
  getDictionary,
  getStudentGrades,
  getSubjectStyle,
  type StudentGradeItem,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { Screen } from "../../components";
import { getSupabase } from "../../lib/supabase";

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

type TypeFilter = "all" | "file" | "test";

function gradeColor(g5: number | null): string {
  if (g5 == null) return colors.textMuted;
  const pct = g5 / 5;
  if (pct >= 0.8) return colors.success;
  if (pct >= 0.5) return colors.warning;
  return colors.danger;
}

export default function GradesScreen() {
  const d = getDictionary(defaultLocale);
  const sb = getSupabase();
  const [grades, setGrades] = useState<StudentGradeItem[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    getStudentGrades(sb).then(setGrades).catch(() => setGrades([]));
  }, [sb]);

  const subjects = useMemo(() => Array.from(new Set(grades.map((g) => g.subject))), [grades]);

  const filtered = useMemo(
    () => grades.filter((g) => (subjectFilter === "all" || g.subject === subjectFilter) && (typeFilter === "all" || g.kind === typeFilter)),
    [grades, subjectFilter, typeFilter],
  );
  const sorted = useMemo(() => [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")), [filtered]);

  const { avgScore, doneCount, bestSubject } = useMemo(() => {
    const scored = filtered.filter((g) => g.grade5 != null);
    const avg = scored.length ? (scored.reduce((s, g) => s + (g.grade5 ?? 0), 0) / scored.length).toFixed(1) : "—";
    let best = "—";
    const allScored = grades.filter((g) => g.grade5 != null);
    if (allScored.length) {
      const by = new Map<string, { sum: number; n: number }>();
      allScored.forEach((g) => { const c = by.get(g.subject) ?? { sum: 0, n: 0 }; c.sum += g.grade5 ?? 0; c.n++; by.set(g.subject, c); });
      let bestAvg = -1;
      by.forEach((v, sub) => { const a = v.sum / v.n; if (a > bestAvg) { bestAvg = a; best = getSubjectStyle(sub).label; } });
    }
    return { avgScore: avg, doneCount: filtered.length, bestSubject: best };
  }, [grades, filtered]);

  const showSubject = subjectFilter === "all";

  return (
    <Screen title="Мои оценки">
      {/* KPI compact */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Средний", value: String(avgScore) },
          { label: "Выполнено", value: String(doneCount) },
          { label: "Лучший", value: bestSubject },
        ].map((k) => (
          <View key={k.label} style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{k.value}</Text>
            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "500", color: colors.textMuted, marginTop: 2 }}>{k.label}</Text>
          </View>
        ))}
      </View>

      {/* Subject pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {[{ key: "all", label: "Все" }, ...subjects.map((s) => ({ key: s, label: getSubjectStyle(s).label, emoji: getSubjectStyle(s).emoji }))].map((p: { key: string; label: string; emoji?: string }) => {
          const active = subjectFilter === p.key;
          return (
            <Pressable key={p.key} onPress={() => setSubjectFilter(p.key)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? colors.primary : colors.bgCard, borderWidth: active ? 0 : 1, borderColor: "rgba(0,0,0,0.06)" }}>
              {p.emoji ? <Text style={{ fontSize: 13 }}>{p.emoji}</Text> : null}
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : colors.textPrimary }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Type pills */}
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
        {([{ key: "all", label: "Все типы" }, { key: "file", label: d.homework.typeFile }, { key: "test", label: d.homework.typeTest }] as { key: TypeFilter; label: string }[]).map((p) => {
          const active = typeFilter === p.key;
          return (
            <Pressable key={p.key} onPress={() => setTypeFilter(p.key)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: active ? "rgba(0,0,0,0.08)" : "transparent" }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: active ? colors.textPrimary : colors.textMuted }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Table (compact rows) */}
      <View style={{ backgroundColor: colors.bgCard, borderRadius: 18, padding: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }}>
        {sorted.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 32 }}>
            По этому предмету пока нет оценённых работ
          </Text>
        ) : (
          sorted.map((g, i) => {
            const style = getSubjectStyle(g.subject);
            return (
              <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: i === sorted.length - 1 ? 0 : 1, borderBottomColor: "rgba(0,0,0,0.05)" }}>
                {showSubject ? <Text style={{ fontSize: 16 }}>{style.emoji}</Text> : null}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>{g.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Text style={{ fontSize: 10, color: colors.textMuted }}>{fmtDate(g.date)}</Text>
                    <View style={{ backgroundColor: g.kind === "test" ? "rgba(124,58,237,0.12)" : "rgba(37,99,235,0.12)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: "600", color: g.kind === "test" ? colors.typeTest : colors.typeFile }}>
                        {g.kind === "test" ? d.homework.typeTest : d.homework.typeFile}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={{ fontSize: 17, fontWeight: "800", color: gradeColor(g.grade5) }}>{g.display}</Text>
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}
