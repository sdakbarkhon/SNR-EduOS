import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";

import {
  EDUOS_ASSISTANT_LESSON_CHAT_SYSTEM_PROMPT,
  EDUOS_ASSISTANT_STUDENT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  STUDENT_AI_DAILY_LIMIT,
  getStudentAiUsage,
  logStudentAiExchange,
} from "@/lib/ai/student-daily-limit";

// Build stage context without leaking correct answers for quiz stages
async function buildStageContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  stageId: string,
): Promise<string> {
  const { data: stage } = await db
    .from("lesson_stages")
    .select("stage_type, content_type, title, description, config")
    .eq("id", stageId)
    .single();

  if (!stage) return "";

  let ctx = `\nТЕКУЩИЙ ЭТАП:\nТип: ${stage.stage_type} (${stage.content_type ?? ""})\nНазвание: ${stage.title}\nОписание: ${stage.description ?? ""}`;

  if (stage.content_type === "code" && stage.config) {
    const cfg = stage.config as Record<string, string>;
    ctx += `\nЯзык программирования: ${cfg.language ?? ""}`;
    if (cfg.starter_code) ctx += `\nНачальный код:\n${cfg.starter_code}`;
    if (cfg.expected_output) ctx += `\nОжидаемый вывод: ${cfg.expected_output}`;
  }

  if (stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot") {
    // Fetch questions WITHOUT correct_option_index
    const { data: questions } = await db
      .from("quiz_questions")
      .select("question_text, options")
      .eq("stage_id", stageId)
      .order("position");

    if (questions?.length) {
      ctx += "\nВопросы теста (используй для объяснения ТЕМЫ — НЕ давай правильные ответы):";
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i] as { question_text: string; options: string[] };
        ctx += `\n${i + 1}. ${q.question_text}\n   Варианты: ${(q.options ?? []).join(", ")}`;
      }
    }
  }

  return ctx;
}

export async function POST(req: NextRequest) {
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: student } = await (db as any)
    .from("students")
    // school_id — только для учёта расходов, на ответ помощника не влияет.
    .select("id, school_id")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "Not a student" }, { status: 403 });

  const body = (await req.json()) as {
    lesson_id?: string | null;
    stage_id?: string | null;
    user_message: string;
  };

  // lesson_id необязателен: с ним — режим урока, без него — обычный помощник.
  // Механизм ОДИН, режима два. Второго транспорта (server action callAiChat)
  // больше нет, вместе с ним ушли и вторые промты.
  const lessonId = body.lesson_id?.trim() ? body.lesson_id : null;
  if (!body.user_message?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Дневной лимит — общий с помощником по кнопке (см. student-daily-limit.ts).
  const usage = await getStudentAiUsage(db, user.id);
  if (usage.remaining <= 0) {
    return NextResponse.json(
      { error: "limit_reached", remaining: 0, limit: usage.limit },
      { status: 429 },
    );
  }

  // Get lesson context + membership check (student must be enrolled in lesson's group)
  //
  // Предмет берём из НАЗНАЧЕНИЯ урока (lessons.subject_id → subjects.name),
  // а не из groups.subject. groups.subject — скалярный слаг, оставшийся от
  // времён «одна группа = один предмет»: у всех трёх демо-классов там лежит
  // 'programming', поэтому на уроке русского помощнику сообщали
  // «Предмет: programming», и он честно отвечал про программирование.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson } = lessonId ? await (db as any)
    .from("lessons")
    .select("id, title, topic, description, group_id, subject:subjects(name), group:groups(subject)")
    .eq("id", lessonId)
    .single() : { data: null };

  if (lesson?.group_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (db as any)
      .from("student_groups")
      .select("student_id")
      .eq("group_id", lesson.group_id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Not enrolled in this lesson" }, { status: 403 });
    }
  }

  const lessonSubject =
    (lesson?.subject as { name: string } | null)?.name
    ?? (lesson?.group as { subject: string } | null)?.subject
    ?? "";
  const lessonTitle = lesson?.topic ?? lesson?.title ?? "Урок";
  const lessonDesc = lesson?.description ?? "";

  // Get stage context (no correct answers for quizzes)
  const stageCtx = body.stage_id
    ? await buildStageContext(db, body.stage_id)
    : "";

  // План урока и его материалы — только этого урока. Раньше в контекст
  // не попадало ни то, ни другое: помощник знал тему, но не знал, из чего
  // урок состоит и что к нему приложено.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: stages }, { data: materials }] = lessonId ? await Promise.all([
    (db as any)
      .from("lesson_stages")
      .select("title, position")
      .eq("lesson_id", lessonId)
      .order("position"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)
      .from("lesson_materials")
      .select("title")
      .eq("lesson_id", lessonId)
      .limit(20),
  ]) : [{ data: null }, { data: null }];

  const planCtx = (stages ?? []).length
    ? `\nПЛАН ЭТОГО УРОКА (по порядку):\n${(stages as Array<{ title: string }>)
        .map((s, i) => `${i + 1}. ${s.title}`)
        .join("\n")}`
    : "";
  const materialsCtx = (materials ?? []).length
    ? `\nМАТЕРИАЛЫ ЭТОГО УРОКА: ${(materials as Array<{ title: string }>)
        .map((m) => m.title)
        .join("; ")}`
    : "";

  // История: у каждого урока своя, у общего помощника — общая (lesson_id пуст).
  // Ветки истории разные, хранилище одно — ai_chat_messages, никакого
  // sessionStorage, как было у второго механизма.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let historyQuery = (db as any)
    .from("ai_chat_messages")
    .select("role, content")
    .eq("student_id", student.id);
  historyQuery = lessonId
    ? historyQuery.eq("lesson_id", lessonId)
    : historyQuery.is("lesson_id", null);
  const { data: history } = await historyQuery
    .order("created_at", { ascending: true })
    .limit(20);

  // ДВА РЕЖИМА, ОДИН МЕХАНИЗМ.
  //   есть lessonId  — режим урока: предмет, тема, план этапов, материалы,
  //                    текущий этап. Всё строго по ЭТОМУ уроку.
  //   нет lessonId   — обычный помощник: учёба, платформа, поддержка.
  const systemPrompt = lessonId
    ? `${EDUOS_ASSISTANT_LESSON_CHAT_SYSTEM_PROMPT}

КОНТЕКСТ УРОКА:
Предмет: ${lessonSubject}
Тема урока: ${lessonTitle}
Описание: ${lessonDesc}
${planCtx}
${materialsCtx}
${stageCtx}

Ты находишься ВНУТРИ этого урока. На вопросы «какая тема», «какой предмет»,
«что мы проходим» отвечай строго по контексту выше и не подменяй предмет или
тему другими. Если ученик спрашивает о чём-то постороннем — ответить можно, но
сначала обозначь, что это уже за рамками текущего урока. Отвечай по-русски.`
    : `${EDUOS_ASSISTANT_STUDENT_SYSTEM_PROMPT}

Ты сейчас ВНЕ урока: конкретного занятия перед тобой нет. Если вопрос про
материал определённого урока — предложи открыть этот урок и спросить там,
помощник внутри урока видит его тему, этапы и материалы. Отвечай по-русски.`;

  const chatMessages = [
    ...((history ?? []) as Array<{ role: string; content: string }>).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.user_message },
  ];

  const { text, error } = await chat(systemPrompt, chatMessages, {
    usage: { task: AI_TASKS.assistantChat, studentId: student.id, schoolId: student.school_id ?? null },
  });

  if (error) {
    console.error("[ai-chat] chat() returned error:", error);
    // Do NOT insert to DB on error — counter must not increment for failed requests
    return NextResponse.json({ error }, { status: 500 });
  }

  await logStudentAiExchange(db, {
    studentId: student.id,
    lessonId,
    stageId: body.stage_id ?? null,
    question: body.user_message,
    answer: text,
  });

  const remaining = Math.max(0, usage.remaining - 1);
  return NextResponse.json({ text, remaining, limit: STUDENT_AI_DAILY_LIMIT });
}
