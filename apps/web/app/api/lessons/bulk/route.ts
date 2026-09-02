import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { createLesson, getCurriculumPlanForGroupSubject, getCurriculumTopicsWithUsage, getLessonDurationForGroup } from "@snr/core";
import {
  planWeeklySchedule, assignTopicsInOrder, ROOM,
  type PlannedLesson, type Weekday,
} from "@/lib/curriculum-lesson-planner";

// Массовое создание уроков: правило «эти дни недели, это время, с такого числа
// по такое» — вместо сотни нажатий на четверть.
//
// ОДИН РАСЧЁТ НА ПРЕДПРОСМОТР И НА СОЗДАНИЕ. Тело принимает preview: true —
// тогда роут считает раскладку и НИЧЕГО не пишет. С preview: false он считает
// её ЗАНОВО тем же кодом и создаёт. Это не лишняя работа, а единственный
// способ не разойтись: раскладка, посчитанная один раз и показанная, к моменту
// согласия могла устареть — за эти секунды кто-то мог завести урок в том же
// слоте. Пересчёт перед записью означает, что «уже есть» проверяется по
// свежим данным, а не по тому, что учитель видел минуту назад.
//
// ЭТАПЫ здесь не создаются: стартовый и итоговый заводит триггер
// trg_lesson_default_stages на самой таблице lessons — одинаково для любого
// способа создания урока.

type Body = {
  groupId?: string;
  subjectId?: string;
  weekdays?: number[];
  time?: string;
  from?: string;
  to?: string;
  useTopics?: boolean;
  room?: string;
  preview?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(req: NextRequest) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
  }

  const groupId = body.groupId?.trim();
  const subjectId = body.subjectId?.trim();
  const time = body.time?.trim();
  const from = body.from?.trim();
  const to = body.to?.trim();
  const weekdays = (body.weekdays ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) as Weekday[];

  if (!groupId || !subjectId) return NextResponse.json({ error: "Не выбрана группа или предмет" }, { status: 400 });
  if (weekdays.length === 0) return NextResponse.json({ error: "Не выбран ни один день недели" }, { status: 400 });
  if (!time || !TIME_RE.test(time)) return NextResponse.json({ error: "Неверное время" }, { status: 400 });
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "Неверный период" }, { status: 400 });
  }
  if (to < from) return NextResponse.json({ error: "Конец периода раньше начала" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher, error: teacherErr } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (teacherErr) return NextResponse.json({ error: teacherErr.message }, { status: 500 });
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  // Права: та же проверка, что у создания уроков из учебного плана —
  // владелец предмета ИЛИ куратор группы. Предмет обязан принадлежать той
  // самой группе: иначе учитель своего предмета в группе А мог бы завести
  // сотню уроков в группе Б.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: subject, error: subjErr }, { data: group, error: grpErr }] = await Promise.all([
    (db as any).from("subjects").select("id, teacher_id, group_id").eq("id", subjectId).maybeSingle(),
    (db as any).from("groups").select("id, teacher_id").eq("id", groupId).maybeSingle(),
  ]);
  if (subjErr || grpErr) {
    return NextResponse.json({ error: (subjErr ?? grpErr)?.message ?? "Ошибка проверки доступа" }, { status: 500 });
  }
  if (!subject || !group) return NextResponse.json({ error: "Группа или предмет не найдены" }, { status: 404 });
  if (subject.group_id !== groupId) {
    return NextResponse.json({ error: "Этот предмет не относится к выбранной группе" }, { status: 403 });
  }
  const isOwner = subject.teacher_id === teacher.id || group.teacher_id === teacher.id;
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Z.3 — «сейчас» от времени школы учителя, не от реальных часов: под
  // заморозкой демо-школы иначе отсекался бы весь период.
  const nowMs = await getMySchoolNowMs(db);

  // 01.09.2026, миграция 246. Длительность урока — одно число на школу.
  // Тело запроса её больше не несёт: окно массового создания о ней не
  // спрашивает, и принимать её здесь значило бы оставить дверь для
  // переопределения на отдельный урок.
  const duration = await getLessonDurationForGroup(db, groupId);

  let planned: PlannedLesson[];
  try {
    planned = await planWeeklySchedule(db, groupId, {
      weekdays, time, from, to, durationMinutes: duration,
    }, nowMs);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка раскладки" }, { status: 500 });
  }

  // Темы из учебного плана этой пары (группа, предмет), по порядку и только
  // свободные: тема, по которой урок уже есть, второй раз не раздаётся.
  let topics: Array<{ id: string; title: string; description: string | null }> = [];
  let planTitle: string | null = null;
  if (body.useTopics) {
    try {
      const plan = await getCurriculumPlanForGroupSubject(db, groupId, subjectId);
      if (plan) {
        planTitle = plan.title;
        const withUsage = await getCurriculumTopicsWithUsage(db, plan.id);
        topics = withUsage
          .filter((t) => t.used_in_lessons === 0)
          .sort((a, b) => a.order_index - b.order_index)
          .map((t) => ({ id: t.id, title: t.title, description: t.description }));
      }
    } catch (e) {
      console.error("[lessons/bulk] не удалось прочитать темы плана:", (e as Error)?.message);
      // Без тем, но с уроками — лучше, чем отказ целиком. Учитель увидит в
      // предпросмотре, что тем нет, и решит сам.
    }
  }

  const { lessons, lessonsWithoutTopic, topicsLeftOver } = assignTopicsInOrder(planned, topics);
  const toCreate = lessons.filter((l) => !l.occupied);
  const occupied = lessons.length - toCreate.length;

  // ── Предпросмотр: ни одной записи ──────────────────────────────────────────
  if (body.preview !== false) {
    return NextResponse.json({
      preview: true,
      lessons,
      willCreate: toCreate.length,
      occupied,
      lessonsWithoutTopic: body.useTopics ? lessonsWithoutTopic : 0,
      topicsLeftOver: body.useTopics ? topicsLeftOver : 0,
      topicsAvailable: topics.length,
      planTitle,
    });
  }

  // ── Создание ───────────────────────────────────────────────────────────────
  // Учитель вписал кабинет — берём его; не вписал — остаётся пустым: ROOM
  // теперь null, и подставлять выдуманный «Кабинет 101» мы перестали.
  // Разбор — в шапке lib/curriculum-lesson-planner.ts.
  const room = body.room?.trim() || ROOM;
  const created: Array<{ id: string; date: string; time: string; topicTitle: string | null }> = [];

  for (const l of toCreate) {
    try {
      const lesson = await createLesson(db, {
        groupId,
        startsAt: `${l.date}T${l.time}:00+05:00`,
        room,
        title: l.topicTitle,
        description: l.topicDescription,
        subjectId,
        curriculumTopicId: l.topicId,
      }, nowMs);
      created.push({ id: lesson.id, date: l.date, time: l.time, topicTitle: l.topicTitle });
    } catch (e) {
      // Частичный успех — честный ответ: сколько уже создано и на чём встали.
      // Откатывать созданное не будем: уроки — не транзакция, и стереть то,
      // что учитель уже мог открыть, хуже, чем сказать правду.
      return NextResponse.json({
        error: `Создано ${created.length} из ${toCreate.length}. Ошибка на ${l.date} ${l.time}: ${e instanceof Error ? e.message : "неизвестная ошибка"}`,
        created: created.length,
        lessons: created,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    preview: false,
    created: created.length,
    occupied,
    lessons: created,
    lessonsWithoutTopic: body.useTopics ? lessonsWithoutTopic : 0,
    topicsLeftOver: body.useTopics ? topicsLeftOver : 0,
  });
}
