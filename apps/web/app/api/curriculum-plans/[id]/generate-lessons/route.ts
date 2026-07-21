import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurriculumPlanById, getCurriculumTopicsWithUsage, createLesson, getGroupLessonsInDateRange } from "@snr/core";

// Учебные планы, Часть 2А — "Создать все уроки автоматически": раскладывает
// НЕиспользованные темы плана по одной в день начиная с 1 августа 2026,
// начиная с 09:00 либо со следующего свободного слота (45 мин урок + 10 мин
// перемена) у ЭТОЙ группы. Идемпотентно: тема считается "уже использована",
// если у неё уже есть привязанный урок (lessons.curriculum_topic_id) — такие
// темы пропускаются, повторный вызов не создаёт дублей.

const AUTO_START_DATE = "2026-08-01";
const SLOT_START_MIN = 9 * 60; // 09:00
const SLOT_DURATION_MIN = 45;
const SLOT_STRIDE_MIN = 55; // урок 45 + перемена 10
const MAX_SLOTS_PER_DAY = 16; // 09:00 .. ~22:00, с большим запасом
const ROOM = "Кабинет 101";

function addDaysUTC(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function tashkentDateOf(iso: string): string {
  const utcMs = new Date(iso).getTime();
  return new Date(utcMs + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Первый свободный слот сетки на эту дату для этой группы, либо null если день занят целиком. */
function findFreeSlot(dayLessons: Array<{ starts_at: string; ends_at: string | null }>, date: string): string | null {
  for (let n = 0; n < MAX_SLOTS_PER_DAY; n++) {
    const startMin = SLOT_START_MIN + n * SLOT_STRIDE_MIN;
    const hhmm = minutesToHHMM(startMin);
    const candStartMs = new Date(`${date}T${hhmm}:00+05:00`).getTime();
    const candEndMs = candStartMs + SLOT_DURATION_MIN * 60 * 1000;
    const overlaps = dayLessons.some((l) => {
      const ls = new Date(l.starts_at).getTime();
      const le = l.ends_at ? new Date(l.ends_at).getTime() : ls + SLOT_DURATION_MIN * 60 * 1000;
      return candStartMs < le && candEndMs > ls;
    });
    if (!overlaps) return hhmm;
  }
  return null;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher, error: teacherErr } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (teacherErr) return NextResponse.json({ error: teacherErr.message }, { status: 500 });
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  let plan;
  try {
    plan = await getCurriculumPlanById(db, planId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки плана" }, { status: 500 });
  }
  if (!plan) return NextResponse.json({ error: "План не найден" }, { status: 404 });

  // Та же проверка владения, что can_manage_curriculum_plan (миграция 120) и
  // /api/curriculum-plans/parse: владелец предмета ИЛИ куратор группы.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: subject, error: subjectError }, { data: group, error: groupError }] = await Promise.all([
    (db as any).from("subjects").select("id, teacher_id").eq("id", plan.subject_id).maybeSingle(),
    (db as any).from("groups").select("id, teacher_id").eq("id", plan.group_id).maybeSingle(),
  ]);
  if (subjectError || groupError) {
    return NextResponse.json({ error: (subjectError ?? groupError)?.message ?? "Ошибка проверки доступа" }, { status: 500 });
  }
  const isOwner = subject?.teacher_id === teacher.id || group?.teacher_id === teacher.id;
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let topicsWithUsage;
  try {
    topicsWithUsage = await getCurriculumTopicsWithUsage(db, planId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки тем" }, { status: 500 });
  }
  const unused = topicsWithUsage.filter((t) => t.used_in_lessons === 0).sort((a, b) => a.order_index - b.order_index);
  const skipped = topicsWithUsage.length - unused.length;

  if (unused.length === 0) {
    return NextResponse.json({ created: 0, skipped, lessons: [], message: "Все темы плана уже созданы как уроки" });
  }

  const rangeTo = addDaysUTC(AUTO_START_DATE, unused.length + 30);
  let existingLessons;
  try {
    existingLessons = await getGroupLessonsInDateRange(db, plan.group_id, AUTO_START_DATE, rangeTo);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка проверки занятости расписания" }, { status: 500 });
  }

  const lessonsByDate = new Map<string, Array<{ starts_at: string; ends_at: string | null }>>();
  for (const l of existingLessons) {
    const key = tashkentDateOf(l.starts_at);
    if (!lessonsByDate.has(key)) lessonsByDate.set(key, []);
    lessonsByDate.get(key)!.push(l);
  }

  const assignments: Array<{ topicId: string; title: string; description: string | null; date: string; time: string }> = [];
  let cursorDate = AUTO_START_DATE;
  for (const topic of unused) {
    let assigned = false;
    for (let guard = 0; guard < 400 && !assigned; guard++) {
      const dayLessons = lessonsByDate.get(cursorDate) ?? [];
      const slot = findFreeSlot(dayLessons, cursorDate);
      if (slot) {
        assignments.push({ topicId: topic.id, title: topic.title, description: topic.description, date: cursorDate, time: slot });
        // Занимаем слот сразу же, чтобы следующая тема (если вдруг попадёт на
        // тот же день из-за guard-обхода) не встала в тот же промежуток.
        const startsAtMs = new Date(`${cursorDate}T${slot}:00+05:00`).getTime();
        lessonsByDate.set(cursorDate, [...dayLessons, {
          starts_at: new Date(startsAtMs).toISOString(),
          ends_at: new Date(startsAtMs + SLOT_DURATION_MIN * 60 * 1000).toISOString(),
        }]);
        cursorDate = addDaysUTC(cursorDate, 1);
        assigned = true;
      } else {
        cursorDate = addDaysUTC(cursorDate, 1);
      }
    }
    if (!assigned) {
      return NextResponse.json({
        error: `Не удалось найти свободный слот для темы «${topic.title}» — расписание группы забито слишком плотно`,
        created: assignments.length,
      }, { status: 500 });
    }
  }

  const created: Array<{ topicId: string; title: string; date: string; time: string }> = [];
  for (const a of assignments) {
    try {
      await createLesson(db, {
        groupId: plan.group_id,
        startsAt: `${a.date}T${a.time}:00+05:00`,
        durationMinutes: SLOT_DURATION_MIN,
        room: ROOM,
        title: a.title,
        description: a.description,
        subjectId: plan.subject_id,
        curriculumTopicId: a.topicId,
      });
      created.push({ topicId: a.topicId, title: a.title, date: a.date, time: a.time });
    } catch (e) {
      return NextResponse.json({
        error: `Создано ${created.length} из ${assignments.length}. Ошибка на теме «${a.title}»: ${e instanceof Error ? e.message : "неизвестная ошибка"}`,
        created: created.length,
        lessons: created,
      }, { status: 500 });
    }
  }

  return NextResponse.json({ created: created.length, skipped, lessons: created });
}
