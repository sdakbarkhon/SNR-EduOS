import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { getCurriculumPlanById, getCurriculumTopicsWithUsage, createLesson, getLessonDurationForGroup } from "@snr/core";
import { planLessonSlots, ROOM, addDaysUTC, tashkentDateOf } from "@/lib/curriculum-lesson-planner";

// Учебные планы — создание уроков из тем плана.
//
// ОДИН РОУТ НА ОБА СЛУЧАЯ. Без тела — раскладывает ВСЕ неиспользованные темы
// (кнопка «Создать все автоматически», как было). С телом {"topicId": "..."} —
// ровно одну тему (кнопка «Создать урок» рядом с темой). Это не два способа, а
// один с фильтром: та же проверка прав, та же раскладка по свободным слотам
// (lib/curriculum-lesson-planner.ts), тот же createLesson, та же
// идемпотентность.
//
// ИДЕМПОТЕНТНОСТЬ. Тема считается использованной, если у неё уже есть
// привязанный урок (lessons.curriculum_topic_id). Такие темы пропускаются, и
// повторный вызов дублей не создаёт — в том числе если по кнопке щёлкнули
// дважды подряд.
//
// ЭТАПЫ УРОКА здесь не создаются и не должны: стартовый и итоговый этапы
// заводит триггер trg_lesson_default_stages на самой таблице lessons. Так это
// работает для ЛЮБОГО способа создания урока, включая обычную форму, — своей
// логики этапов ни у одного из путей нет.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Тело необязательное: старый вызов «создать все» шлёт POST без него вовсе,
  // и падать на разборе пустого тела нельзя.
  let onlyTopicId: string | null = null;
  let startDate: string | null = null;
  try {
    const body = (await req.json()) as { topicId?: string; startDate?: string } | null;
    onlyTopicId = body?.topicId?.trim() ? body.topicId : null;
    startDate = body?.startDate?.trim() ? body.startDate.trim() : null;
  } catch { /* тела нет — значит «создать все» */ }

  // 02.09.2026, пункт 13. День начала выбирает учитель. Не прислал — берём
  // школьное завтра: сегодняшние слоты могли уже пройти, и предлагать их
  // значило бы обещать несбыточное (createLesson отвергает прошлое).
  if (startDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Неверная дата начала" }, { status: 400 });
  }

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

  // Тема из тела должна принадлежать ЭТОМУ плану: id приходит от клиента, и
  // проверка владения планом сама по себе чужую тему не отсекает.
  if (onlyTopicId && !topicsWithUsage.some((t) => t.id === onlyTopicId)) {
    return NextResponse.json({ error: "Тема не найдена в этом плане" }, { status: 404 });
  }

  const candidates = onlyTopicId
    ? topicsWithUsage.filter((t) => t.id === onlyTopicId)
    : topicsWithUsage;
  const unused = candidates.filter((t) => t.used_in_lessons === 0).sort((a, b) => a.order_index - b.order_index);
  const skipped = candidates.length - unused.length;

  if (unused.length === 0) {
    // Урок уже есть — возвращаем ссылку на него, а не отказ: кнопка рядом с
    // темой должна привести к существующему уроку, а не сообщить об ошибке.
    const already = candidates[0];
    return NextResponse.json({
      created: 0,
      skipped,
      lessons: [],
      existingLessonId: already?.lesson_id ?? null,
      message: onlyTopicId ? "Урок по этой теме уже создан" : "Все темы плана уже созданы как уроки",
    });
  }

  // Z.3, заход 2 — валидация даты создаваемого урока от времени школы
  // учителя. Нужен и раскладке: она не должна предлагать прошедшие даты.
  const nowMs = await getMySchoolNowMs(db);
  // Школьное завтра как запасной вариант — тем же счётом по Ташкенту, каким
  // раскладка сравнивает даты.
  const отДня = startDate ?? addDaysUTC(tashkentDateOf(new Date(nowMs).toISOString()), 1);

  // 01.09.2026, миграция 246. Длительность урока — одно число на школу; здесь
  // она нужна и раскладке (чтобы понимать, наезжает ли слот на существующий
  // урок), и никому больше: createLesson читает её сам.
  const duration = await getLessonDurationForGroup(db, plan.group_id);

  let assignments;
  try {
    assignments = await planLessonSlots(db, plan.group_id, unused, nowMs, duration, отДня);
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Ошибка подбора места в расписании",
      created: 0,
    }, { status: 500 });
  }

  const created: Array<{ topicId: string; title: string; date: string; time: string; lessonId: string }> = [];

  for (const a of assignments) {
    try {
      const lesson = await createLesson(db, {
        groupId: plan.group_id,
        startsAt: `${a.date}T${a.time}:00+05:00`,
        room: ROOM,
        title: a.title,
        description: a.description,
        subjectId: plan.subject_id,
        curriculumTopicId: a.topicId,
      }, nowMs);
      created.push({ topicId: a.topicId, title: a.title, date: a.date, time: a.time, lessonId: lesson.id });
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
