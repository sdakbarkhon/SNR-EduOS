import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  defaultLocale,
  formatDate,
  getDictionary,
  getLessons,
  getMyGroups,
  getMySubmissions,
  getHomework,
  getTeachers,
  getSubjectStyle,
  lessonStatus,
  lessonsOnDay,
  type Group,
  type Homework,
  type HomeworkSubmission,
  type Lesson,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { EmptyState, LessonRow, Screen, SegmentedTabs, SubjectIcon } from "../../components";
import { getSupabase } from "../../lib/supabase";

type Tab = "today" | "week";
type TeacherMin = { id: string; full_name: string };

export default function ScheduleScreen() {
  const d = getDictionary(defaultLocale);
  const sb = getSupabase();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<TeacherMin[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  useEffect(() => {
    const load = async () => {
      const [l, g, t, hw, sub] = await Promise.all([
        getLessons(sb),
        getMyGroups(sb),
        getTeachers(sb),
        getHomework(sb),
        getMySubmissions(sb),
      ]);
      setLessons(l);
      setGroups(g);
      setTeachers(t);
      setHomework(hw);
      setSubmissions(sub);
    };
    load();

    const channel = sb
      .channel("mobile-schedule-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLessons((prev) =>
              [...prev, payload.new as Lesson].sort((a, b) =>
                a.starts_at.localeCompare(b.starts_at),
              ),
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Lesson;
            setLessons((prev) =>
              prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
            );
          } else if (payload.eventType === "DELETE") {
            setLessons((prev) => prev.filter((l) => l.id !== (payload.old as { id: string }).id));
          }
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const now = Date.now();

  function buildRow(lesson: Lesson) {
    const group = groupById.get(lesson.group_id);
    const subject = group?.subject ?? null;
    const teacherName = group?.teacher_id
      ? teacherById.get(group.teacher_id)?.full_name
      : undefined;
    const style = getSubjectStyle(subject);
    const badge = lessonStatus(lesson, now);
    const startMs = new Date(lesson.starts_at).getTime();
    const endMs = lesson.ends_at
      ? new Date(lesson.ends_at).getTime()
      : startMs + 45 * 60 * 1000;
    const durationMin = Math.round((endMs - startMs) / 60000);
    const lessonTitle =
      lesson.topic ?? (lesson.lesson_no ? `Урок ${lesson.lesson_no}` : "Урок");

    return (
      <View key={lesson.id} style={{ marginBottom: 10 }}>
        <LessonRow
          time={new Date(lesson.starts_at).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          duration={`${durationMin} мин`}
          subject={subject}
          title={lessonTitle}
          room={lesson.room}
          teacher={teacherName ?? null}
          colorBar={style.color}
          status={{ variant: badge.variant, label: d.status[badge.key] }}
        />
      </View>
    );
  }

  const dayLessons = useMemo(() => lessonsOnDay(lessons, selectedDay), [lessons, selectedDay]);

  const dayLabel = (() => {
    const s = selectedDay.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const weekData = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const result: { date: Date; items: Lesson[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start.getTime() + i * 86_400_000);
      const items = lessonsOnDay(lessons, date);
      if (items.length) result.push({ date, items });
    }
    return result;
  }, [lessons]);

  const pendingHW = useMemo(() => {
    const submittedIds = new Set(submissions.map((s) => s.homework_id));
    return homework.filter((h) => !submittedIds.has(h.id)).slice(0, 5);
  }, [homework, submissions]);

  const tabs = [
    { key: "today", label: d.schedule.today },
    { key: "week", label: d.schedule.week },
  ];

  return (
    <Screen title={d.schedule.title}>
      {/* Табы */}
      <SegmentedTabs
        tabs={tabs}
        value={tab}
        onChange={(k) => setTab(k as Tab)}
      />

      <View style={{ height: 16 }} />

      {tab === "today" ? (
        <>
          {/* Навигация по дням */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, flex: 1 }}>
              {dayLabel}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setSelectedDay((d) => new Date(d.getTime() - 86_400_000))}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 18 }}>‹</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedDay((d) => new Date(d.getTime() + 86_400_000))}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 18 }}>›</Text>
              </Pressable>
            </View>
          </View>

          {dayLessons.length ? (
            dayLessons.map(buildRow)
          ) : (
            <EmptyState>{d.schedule.noLessons}</EmptyState>
          )}
        </>
      ) : (
        /* Неделя */
        <>
          {weekData.length ? (
            weekData.map(({ date, items }) => {
              const lbl = date.toLocaleDateString("ru-RU", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
              const lblCap = lbl.charAt(0).toUpperCase() + lbl.slice(1);
              return (
                <View key={date.toISOString()} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textMuted, marginBottom: 10 }}>
                    {lblCap}
                  </Text>
                  {items.map(buildRow)}
                </View>
              );
            })
          ) : (
            <EmptyState>{d.common.none}</EmptyState>
          )}
        </>
      )}

      {/* ДЗ к выполнению */}
      {pendingHW.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 12 }}>
            {d.homework.title}
          </Text>
          {pendingHW.map((hw) => {
            const subject = groupById.get(hw.group_id)?.subject ?? null;
            return (
              <View
                key={hw.id}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                  backgroundColor: colors.bgCard,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <SubjectIcon subject={subject} size={32} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
                    {hw.title}
                  </Text>
                  {hw.due_date ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      до {formatDate(hw.due_date)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
