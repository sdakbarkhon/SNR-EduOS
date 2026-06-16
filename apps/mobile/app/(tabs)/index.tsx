import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  attendancePercent,
  defaultLocale,
  format,
  formatDate,
  formatTime,
  getAttendance,
  getDictionary,
  getHomework,
  getLessons,
  getMaterials,
  getMyGroups,
  getMyStudent,
  getMySubmissions,
  getSubjectStyle,
  nextLesson,
  type CourseMaterial,
  type Student,
} from "@snr/core";
import { colors, factBanner, sidebar } from "@snr/ui-tokens";
import {
  KpiCard,
  MaterialTile,
  RingProgress,
  Screen,
  SubjectIcon,
} from "../../components";
import { getSupabase } from "../../lib/supabase";

const FACT = {
  title: "Первый программист в мире — женщина!",
  body: "Ада Лавлейс написала первую программу для аналитической машины Бэббиджа.",
};

type DashData = {
  student: Student;
  nextLabel: string;
  nextFooter: string | null;
  activeCount: number;
  attPct: number;
  subjects: string[];
  recent: CourseMaterial[];
};

export default function DashboardScreen() {
  const d = getDictionary(defaultLocale);
  const [data, setData] = useState<DashData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    Promise.all([
      getMyStudent(sb),
      getLessons(sb),
      getHomework(sb),
      getMySubmissions(sb),
      getAttendance(sb),
      getMyGroups(sb),
      getMaterials(sb),
    ])
      .then(([student, lessons, homework, submissions, attendance, groups, materials]) => {
        const groupById = new Map(groups.map((g) => [g.id, g]));
        const next = nextLesson(lessons);
        const nextSubject = next ? (groupById.get(next.group_id)?.subject ?? null) : null;
        const submitted = new Set(submissions.map((s) => s.homework_id));
        setData({
          student,
          nextLabel: next ? getSubjectStyle(nextSubject).label : d.dashboard.noNextLesson,
          nextFooter: next
            ? `${formatTime(next.starts_at)}${next.room ? ` · ${d.dashboard.room} ${next.room}` : ""}`
            : null,
          activeCount: homework.filter((h) => !submitted.has(h.id)).length,
          attPct: attendancePercent(attendance),
          subjects: Array.from(new Set(groups.map((g) => g.subject))),
          recent: materials.slice(0, 4),
        });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <Screen title={d.nav.home}>
        <Text style={{ color: colors.textMuted }}>{d.common.error}</Text>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title={d.nav.home}>
        <Text style={{ color: colors.textMuted }}>{d.common.loading}</Text>
      </Screen>
    );
  }

  const firstName = data.student.full_name.split(" ")[0] ?? data.student.full_name;
  const activeSuffix = format(d.dashboard.activeTasks, { count: "" }).trim();

  return (
    <Screen title={format(d.dashboard.greeting, { name: firstName })}>
      {/* KPI — 2 карточки в ряд */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <KpiCard
          title={d.dashboard.nextLesson}
          value={data.nextLabel}
          footer={data.nextFooter ?? undefined}
        />
        <KpiCard
          title={d.dashboard.myTasks}
          value={`${data.activeCount} ${activeSuffix}`}
        />
      </View>

      {/* Прогресс недели */}
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.75)",
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.6)",
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          padding: 16,
        }}
      >
        <RingProgress value={data.attPct} size={64} />
        <View>
          <Text style={{ fontSize: 28, fontWeight: "700", color: "#111827", lineHeight: 32 }}>
            {data.attPct}%
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
            {d.dashboard.weekProgress} · {d.attendance.overall}
          </Text>
        </View>
      </View>

      {/* Факт дня */}
      <View
        style={{
          borderRadius: 24,
          padding: 20,
          overflow: "hidden",
          backgroundColor: factBanner.from,
        }}
      >
        {/* Использование градиента через solid fallback (expo-linear-gradient не подключён) */}
        <Text
          style={{
            color: "rgba(191,219,254,0.9)",
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1.5,
          }}
        >
          {d.dashboard.factOfDay}
        </Text>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 6 }}>
          {FACT.title}
        </Text>
        <Text style={{ color: "rgba(219,234,254,0.9)", fontSize: 13, marginTop: 6, lineHeight: 20 }}>
          {FACT.body}
        </Text>
      </View>

      {/* Мои предметы */}
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1F2937" }}>
          {d.dashboard.mySubjects}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {data.subjects.map((s) => (
            <View key={s} style={{ alignItems: "center", gap: 6, width: 72 }}>
              <SubjectIcon subject={s} size={56} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  textAlign: "center",
                  fontWeight: "600",
                }}
                numberOfLines={2}
              >
                {getSubjectStyle(s).label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Недавние материалы */}
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1F2937" }}>
          {d.dashboard.recentMaterials}
        </Text>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.75)",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.6)",
            padding: 8,
          }}
        >
          {data.recent.map((m) => (
            <MaterialTile
              key={m.id}
              title={m.title}
              type={m.type}
              meta={formatDate(m.created_at)}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
