import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  defaultLocale,
  getDictionary,
  getStudentGrades,
  getSubjectStyle,
  type StudentGradeItem,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { Screen, SubjectIcon } from "../../components";
import { getSupabase } from "../../lib/supabase";

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function gradeColor(g5: number | null): string {
  if (g5 == null) return colors.textMuted;
  if (g5 >= 4.5) return colors.success;
  if (g5 >= 3.0) return colors.warning;
  return colors.danger;
}

export default function GradesScreen() {
  const d = getDictionary(defaultLocale);
  const sb = getSupabase();
  const [grades, setGrades] = useState<StudentGradeItem[]>([]);

  useEffect(() => {
    getStudentGrades(sb).then(setGrades).catch(() => setGrades([]));
  }, [sb]);

  const { avgScore, doneCount, bestSubject, groups } = useMemo(() => {
    const scored = grades.filter((g) => g.grade5 != null);
    const avg = scored.length
      ? (scored.reduce((a, g) => a + (g.grade5 ?? 0), 0) / scored.length).toFixed(1)
      : "—";

    let best = "—";
    if (scored.length) {
      const bySub = new Map<string, { sum: number; n: number }>();
      scored.forEach((g) => {
        const cur = bySub.get(g.subject) ?? { sum: 0, n: 0 };
        cur.sum += g.grade5 ?? 0; cur.n += 1;
        bySub.set(g.subject, cur);
      });
      let bestAvg = -1;
      bySub.forEach((v, sub) => {
        const a = v.sum / v.n;
        if (a > bestAvg) { bestAvg = a; best = getSubjectStyle(sub).label; }
      });
    }

    const subjects = Array.from(new Set(grades.map((g) => g.subject)));
    const grouped = subjects
      .map((sub) => ({ sub, items: grades.filter((g) => g.subject === sub) }))
      .filter((grp) => grp.items.length > 0);

    return { avgScore: avg, doneCount: grades.length, bestSubject: best, groups: grouped };
  }, [grades]);

  return (
    <Screen title="Мои оценки">
      {/* KPI */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Средний балл", value: String(avgScore) },
          { label: "Выполнено", value: String(doneCount) },
          { label: "Лучший предмет", value: bestSubject },
        ].map((k) => (
          <View key={k.label} style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 18, padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>{k.value}</Text>
            <Text style={{ fontSize: 10, fontWeight: "500", color: colors.textMuted, marginTop: 4 }}>{k.label}</Text>
          </View>
        ))}
      </View>

      {groups.length === 0 ? (
        <View style={{ backgroundColor: colors.bgCard, borderRadius: 20, padding: 24 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
            У тебя пока нет оценённых работ
          </Text>
        </View>
      ) : (
        groups.map(({ sub, items }) => {
          const style = getSubjectStyle(sub);
          const scoredItems = items.filter((g) => g.grade5 != null);
          const subAvg = scoredItems.length
            ? (scoredItems.reduce((a, g) => a + (g.grade5 ?? 0), 0) / scoredItems.length).toFixed(1)
            : "—";
          const sorted = [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

          return (
            <View key={sub} style={{ marginBottom: 20 }}>
              {/* Section header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", justifyContent: "center", alignItems: "center" }}>
                  <SubjectIcon subject={sub} size={18} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>{style.label}</Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: style.color }}>{subAvg}
                  <Text style={{ fontSize: 11, fontWeight: "500", color: colors.textMuted }}> / 5</Text>
                </Text>
              </View>

              {/* Cards */}
              {sorted.map((g) => (
                <View key={g.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: colors.bgCard, borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <View style={{ backgroundColor: g.kind === "test" ? "rgba(124,58,237,0.12)" : "rgba(37,99,235,0.12)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "600", color: g.kind === "test" ? colors.typeTest : colors.typeFile }}>
                          {g.kind === "test" ? d.homework.typeTest : d.homework.typeFile}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{fmtDate(g.date)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{g.title}</Text>
                    {g.comment ? (
                      <Text style={{ fontSize: 12, fontStyle: "italic", color: colors.textMuted, marginTop: 4 }}>«{g.comment}»</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: gradeColor(g.grade5) }}>{g.display}</Text>
                </View>
              ))}
            </View>
          );
        })
      )}
    </Screen>
  );
}
