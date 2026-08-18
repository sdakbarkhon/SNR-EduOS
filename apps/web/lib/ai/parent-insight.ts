import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { buildParentInsightPrompt, type InsightDataContext } from "@/lib/ai/prompts";
import { PARENT_INSIGHT_SCHEMA } from "@/lib/ai/schemas";
import { getMySchoolNowMs } from "@/lib/school-time-server";

/**
 * Разбор помощника EduOS по ребёнку — общая часть для мобильного и веба.
 *
 * Раньше весь этот код жил внутри `app/api/mobile/insight/route.ts` и был
 * доступен только мобильному приложению: тот роут требует
 * `Authorization: Bearer`, а веб ходит с cookie. Веб-экран помощника не мог
 * бы им воспользоваться, а копия на 150 строк — ровно то, чего в проекте
 * велено не плодить. Поэтому логика здесь, а роут и серверное действие веба
 * стали двумя тонкими обёртками, отличающимися ТОЛЬКО способом входа.
 *
 * Поведение сохранено дословно: недельный кэш, тот же контекст за 30 дней,
 * та же модель, та же запись служебным ключом (миграция 128 не даёт INSERT
 * никому другому), тот же откат на прошлую запись при отказе модели.
 */

const CACHE_DAYS = 7;
const LOOKBACK_DAYS = 30;

export const INSIGHT_LOCALES = ["ru", "uz", "en"] as const;
export type InsightLocale = (typeof INSIGHT_LOCALES)[number];

export type InsightPayload = {
  summary: string;
  insights: Array<{ title: string; body: string; category: string; sentiment: string }>;
};

export type InsightResult =
  | { ok: true; payload: InsightPayload; generatedAt: string; cached: boolean; stale?: boolean }
  | { ok: false; status: number; error: string };

/** Клиент базы под правами вызывающего: cookie-клиент в вебе, bearer в мобилке. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export function normalizeInsightLocale(raw: string | null | undefined): InsightLocale {
  return INSIGHT_LOCALES.includes(raw as InsightLocale) ? (raw as InsightLocale) : "ru";
}

/** Момент N дней назад от школьного «сейчас». */
function daysAgoIso(days: number, nowMs: number): string {
  return new Date(nowMs - days * 86400000).toISOString();
}

/**
 * Собрать (или достать из кэша) разбор по ребёнку.
 *
 * `db` обязан быть клиентом ПОД ПРАВАМИ РОДИТЕЛЯ: связь «родитель ↔ ребёнок»
 * проверяется через него же, поэтому подсунуть чужого ребёнка нельзя.
 */
export async function buildParentInsight(
  db: Db,
  opts: { userId: string; childId: string; locale: InsightLocale; force?: boolean },
): Promise<InsightResult> {
  const { userId, childId, locale, force = false } = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const { data: parent } = await anyDb.from("parents").select("id").eq("user_id", userId).maybeSingle();
  if (!parent) return { ok: false, status: 403, error: "Not a parent" };

  const { data: link } = await anyDb
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parent.id)
    .eq("student_id", childId)
    .maybeSingle();
  if (!link) return { ok: false, status: 403, error: "Forbidden" };

  const { data: student } = await anyDb
    .from("students")
    .select("id, full_name, school_id, student_groups(groups(id, name))")
    .eq("id", childId)
    .maybeSingle();
  if (!student) return { ok: false, status: 404, error: "Student not found" };

  const groups = (student.student_groups ?? [])
    .map((sg: { groups: { id: string; name: string } | null }) => sg.groups)
    .filter(Boolean) as Array<{ id: string; name: string }>;
  const groupIds = groups.map((g) => g.id);
  const className = groups[0]?.name ?? "—";

  // ── 1. Недельный кэш: сначала база, модель повторно не дёргаем ──────────
  const { data: cached } = await anyDb
    .from("parent_insights")
    .select("insight_json, generated_at")
    .eq("child_id", childId)
    .eq("locale", locale)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ОБА конца от одной школы: generated_at пишется этим же временем, и
  // сравнение с ним обязано вестись им же (иначе кэш вечно свежий/протухший).
  const nowMs = await getMySchoolNowMs(db);

  if (!force && cached && new Date(cached.generated_at).getTime() >= nowMs - CACHE_DAYS * 86400000) {
    return {
      ok: true,
      payload: cached.insight_json as InsightPayload,
      generatedAt: cached.generated_at as string,
      cached: true,
    };
  }

  // ── 2. Контекст за 30 дней ──────────────────────────────────────────────
  const since = daysAgoIso(LOOKBACK_DAYS, nowMs);

  const { data: attendanceRows } = await anyDb
    .from("attendance")
    .select("status, lesson:lessons!inner(starts_at)")
    .eq("student_id", childId)
    .gte("lesson.starts_at", since);
  const attendance = (attendanceRows ?? []) as Array<{ status: string }>;
  const attendanceTotal = attendance.length;
  const attendancePresent = attendance.filter((a) => a.status === "present").length;
  const missedLessons = attendance.filter(
    (a) => a.status === "absent_excused" || a.status === "absent_unexcused",
  ).length;
  const attendancePercent = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 100;

  const { data: gradeRows } = await anyDb
    .from("lesson_grades")
    .select("grade, lesson:lessons!inner(subject:subjects(name))")
    .eq("student_id", childId)
    .gte("graded_at", since);
  const grades = (gradeRows ?? []) as Array<{ grade: number; lesson: { subject: { name: string } | null } | null }>;
  const averageGrade = grades.length > 0 ? grades.reduce((sum, g) => sum + g.grade, 0) / grades.length : null;
  const bySubject = new Map<string, { sum: number; count: number }>();
  for (const g of grades) {
    const name = g.lesson?.subject?.name ?? "—";
    const cur = bySubject.get(name) ?? { sum: 0, count: 0 };
    cur.sum += g.grade;
    cur.count += 1;
    bySubject.set(name, cur);
  }
  const subjectGrades = Array.from(bySubject.entries()).map(([subjectName, v]) => ({
    subjectName,
    average: v.sum / v.count,
  }));

  let homeworkOnTime = 0;
  let homeworkOverdue = 0;
  let homeworkTotal = 0;
  if (groupIds.length > 0) {
    const { data: hwRows } = await anyDb
      .from("homework")
      .select("id, due_date")
      .in("group_id", groupIds)
      .gte("created_at", since);
    const homeworkList = (hwRows ?? []) as Array<{ id: string; due_date: string | null }>;
    homeworkTotal = homeworkList.length;
    if (homeworkList.length > 0) {
      const { data: subRows } = await anyDb
        .from("homework_submissions")
        .select("homework_id, submitted_at")
        .eq("student_id", childId)
        .in("homework_id", homeworkList.map((h) => h.id));
      const submittedByHw = new Map(
        (subRows ?? []).map((s: { homework_id: string; submitted_at: string }) => [s.homework_id, s.submitted_at]),
      );
      for (const hw of homeworkList) {
        const submittedAt = submittedByHw.get(hw.id) as string | undefined;
        const dueMs = hw.due_date ? new Date(hw.due_date).getTime() : null;
        if (submittedAt && (!dueMs || new Date(submittedAt).getTime() <= dueMs)) {
          homeworkOnTime++;
        } else if (!submittedAt && dueMs && dueMs < nowMs) {
          homeworkOverdue++;
        }
        // иначе — сдано с опозданием ИЛИ срок ещё не наступил: не считаем
        // ни в одну из двух метрик (упрощённая модель без отдельного "late").
      }
    }
  }

  const context: InsightDataContext = {
    childName: student.full_name,
    className,
    averageGrade,
    attendancePercent,
    missedLessons,
    homeworkOnTime,
    homeworkTotal,
    homeworkOverdue,
    subjectGrades,
  };

  // ── 3. Модель ───────────────────────────────────────────────────────────
  const prompt = buildParentInsightPrompt(context, locale);
  const { data: generated, error } = await generateJSON<InsightPayload>(prompt, PARENT_INSIGHT_SCHEMA, {
    temperature: 0.7,
    usage: { task: AI_TASKS.parentInsight, schoolId: student.school_id, studentId: childId },
  });

  if (error || !generated) {
    console.error("[parent-insight] generation failed:", error);
    // Откат: последняя запись из базы, даже если старше недели.
    if (cached) {
      return {
        ok: true,
        payload: cached.insight_json as InsightPayload,
        generatedAt: cached.generated_at as string,
        cached: true,
        stale: true,
      };
    }
    return { ok: false, status: 500, error: error || "Не удалось сгенерировать анализ" };
  }

  // ── 4. Запись служебным ключом (RLS не даёт INSERT никому другому) ──────
  const generatedAt = new Date(nowMs).toISOString();
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("parent_insights").insert({
      child_id: childId,
      locale,
      insight_json: generated,
      generated_at: generatedAt,
      school_id: student.school_id,
    });
  } catch (e) {
    console.error("[parent-insight] failed to persist (returning it anyway):", (e as Error)?.message);
  }

  return { ok: true, payload: generated, generatedAt, cached: false };
}
