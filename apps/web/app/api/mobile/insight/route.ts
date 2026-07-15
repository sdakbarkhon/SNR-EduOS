import { NextRequest, NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai/gemini-client";
import { buildParentInsightPrompt, type InsightDataContext } from "@/lib/ai/prompts";
import { PARENT_INSIGHT_SCHEMA } from "@/lib/ai/schemas";

// Промт МОБ-7, ЧАСТЬ 2 — v8 "EduOS Assistant Insight". Вызывается из
// apps/mobile-parent/src/screens/InsightScreen.tsx — мобильный fetch не
// несёт cookies (в отличие от веба), поэтому этот роут НЕ использует
// createClient() из lib/supabase/server.ts (cookie-based), а требует
// Authorization: Bearer <access_token> и строит RLS-клиент через
// createBearerClient() (lib/supabase/bearer.ts) — тот же anon key, но
// auth.uid() резолвится из явно переданного JWT для ЛЮБОГО запроса через
// этот клиент, не только auth.getUser(). Запись в parent_insights всё
// равно идёт через createAdminClient() (service_role) — см. миграцию 128,
// INSERT туда никому кроме service_role не разрешён.

export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_DAYS = 7;
const LOOKBACK_DAYS = 30;
const ALLOWED_LOCALES = ["ru", "uz", "en"] as const;
type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

type InsightPayload = { summary: string; insights: Array<{ title: string; body: string; category: string; sentiment: string }> };

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createBearerClient(token);

  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (db as any).from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (!parent) return NextResponse.json({ error: "Not a parent" }, { status: 403 });

  const body = (await req.json()) as { childId?: string; locale?: string; force?: boolean };
  const childId = body.childId;
  const locale: AllowedLocale = ALLOWED_LOCALES.includes(body.locale as AllowedLocale) ? (body.locale as AllowedLocale) : "ru";
  const force = body.force === true;

  if (!childId) return NextResponse.json({ error: "childId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link } = await (db as any)
    .from("parent_students").select("student_id").eq("parent_id", parent.id).eq("student_id", childId).maybeSingle();
  if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: student } = await (db as any)
    .from("students")
    .select("id, full_name, school_id, student_groups(groups(id, name))")
    .eq("id", childId)
    .maybeSingle();
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  const groups = (student.student_groups ?? []).map((sg: { groups: { id: string; name: string } | null }) => sg.groups).filter(Boolean);
  const groupIds: string[] = groups.map((g: { id: string }) => g.id);
  const className = groups[0]?.name ?? "—";

  // ── 1. Недельный кэш: сначала БД, Gemini не дёргаем повторно в течение
  // CACHE_DAYS. Читаем через RLS-клиент (is_my_child() уже скоупит доступ). ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cached } = await (db as any)
    .from("parent_insights")
    .select("insight_json, generated_at")
    .eq("child_id", childId)
    .eq("locale", locale)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!force && cached && new Date(cached.generated_at).getTime() >= Date.now() - CACHE_DAYS * 86400000) {
    return NextResponse.json({ ...(cached.insight_json as InsightPayload), generatedAt: cached.generated_at, cached: true });
  }

  // ── 2. Собираем контекст за 30 дней ────────────────────────────────────
  const since = daysAgoIso(LOOKBACK_DAYS);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: attendanceRows } = await (db as any)
    .from("attendance")
    .select("status, lesson:lessons!inner(starts_at)")
    .eq("student_id", childId)
    .gte("lesson.starts_at", since);
  const attendance = (attendanceRows ?? []) as Array<{ status: string }>;
  const attendanceTotal = attendance.length;
  const attendancePresent = attendance.filter((a) => a.status === "present").length;
  const missedLessons = attendance.filter((a) => a.status === "absent_excused" || a.status === "absent_unexcused").length;
  const attendancePercent = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gradeRows } = await (db as any)
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
  const subjectGrades = Array.from(bySubject.entries()).map(([subjectName, v]) => ({ subjectName, average: v.sum / v.count }));

  let homeworkOnTime = 0;
  let homeworkOverdue = 0;
  let homeworkTotal = 0;
  if (groupIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: hwRows } = await (db as any)
      .from("homework")
      .select("id, due_date")
      .in("group_id", groupIds)
      .gte("created_at", since);
    const homeworkList = (hwRows ?? []) as Array<{ id: string; due_date: string | null }>;
    homeworkTotal = homeworkList.length;
    if (homeworkList.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subRows } = await (db as any)
        .from("homework_submissions")
        .select("homework_id, submitted_at")
        .eq("student_id", childId)
        .in("homework_id", homeworkList.map((h) => h.id));
      const submittedByHw = new Map((subRows ?? []).map((s: { homework_id: string; submitted_at: string }) => [s.homework_id, s.submitted_at]));
      const nowMs = Date.now();
      for (const hw of homeworkList) {
        const submittedAt = submittedByHw.get(hw.id) as string | undefined;
        const dueMs = hw.due_date ? new Date(hw.due_date).getTime() : null;
        if (submittedAt && (!dueMs || new Date(submittedAt).getTime() <= dueMs)) {
          homeworkOnTime++;
        } else if (!submittedAt && dueMs && dueMs < nowMs) {
          homeworkOverdue++;
        }
        // иначе — сдано с опозданием ИЛИ ещё не наступил срок: не считаем
        // ни в одну из двух метрик (упрощённая модель без отдельного "late",
        // см. resheniya_2.md — тот же принцип, что уже применён к attendance).
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

  // ── 3. Gemini ────────────────────────────────────────────────────────────
  const prompt = buildParentInsightPrompt(context, locale);
  const { data: generated, error } = await generateJSON<InsightPayload>(prompt, PARENT_INSIGHT_SCHEMA, { temperature: 0.7 });

  if (error || !generated) {
    console.error("[mobile-insight] generation failed:", error);
    // Fallback: последняя запись из БД, даже если старше недели.
    if (cached) {
      return NextResponse.json({ ...(cached.insight_json as InsightPayload), generatedAt: cached.generated_at, cached: true, stale: true });
    }
    return NextResponse.json({ error: error || "Не удалось сгенерировать анализ" }, { status: 500 });
  }

  // ── 4. Пишем в БД через service_role (RLS не даёт INSERT никому другому) ──
  const generatedAt = new Date().toISOString();
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
    console.error("[mobile-insight] failed to persist insight (returning it anyway):", (e as Error)?.message);
  }

  return NextResponse.json({ ...generated, generatedAt, cached: false });
}
