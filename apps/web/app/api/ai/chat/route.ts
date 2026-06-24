import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/ai-gemini";

const DAILY_LIMIT = 10;

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
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "Not a student" }, { status: 403 });

  const body = (await req.json()) as {
    lesson_id: string;
    stage_id?: string | null;
    user_message: string;
  };

  if (!body.lesson_id || !body.user_message?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Check daily limit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dayCountRaw } = await (db as any).rpc("fn_ai_messages_today", {
    p_student_id: student.id,
  });
  const dayCount = (dayCountRaw as number) ?? 0;
  if (dayCount >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "Лимит исчерпан до завтра", remaining: 0 },
      { status: 429 },
    );
  }

  // Get lesson context + membership check (student must be enrolled in lesson's group)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson } = await (db as any)
    .from("lessons")
    .select("id, title, topic, description, group_id, group:groups(subject)")
    .eq("id", body.lesson_id)
    .single();

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

  const lessonSubject = (lesson?.group as { subject: string } | null)?.subject ?? "";
  const lessonTitle = lesson?.title ?? lesson?.topic ?? "Урок";
  const lessonDesc = lesson?.description ?? "";

  // Get stage context (no correct answers for quizzes)
  const stageCtx = body.stage_id
    ? await buildStageContext(db, body.stage_id)
    : "";

  // Get chat history (last 20 messages)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: history } = await (db as any)
    .from("ai_chat_messages")
    .select("role, content")
    .eq("student_id", student.id)
    .eq("lesson_id", body.lesson_id)
    .order("created_at", { ascending: true })
    .limit(20);

  const systemPrompt = `Ты — дружелюбный помощник для школьника на онлайн-уроке. Твоё имя — Робокот 🤖.

ПРАВИЛА (СТРОГО):
1. Ты НИКОГДА не даёшь готовое решение задачи. Только наводящие вопросы и подход.
2. Ты НИКОГДА не пишешь полный код за ученика. Можешь показать ПРИНЦИП на маленьком абстрактном примере.
3. Если это квиз/тест — ты НЕ называешь правильный ответ. Можешь только намекнуть, объяснить тему вопроса.
4. Отвечай ПРОСТО и КОРОТКО. 2-4 предложения максимум.
5. Используй эмодзи иногда (1-2 на ответ).
6. Если ученик настойчиво просит готовый ответ — мягко откажи и объясни что лучше думать самому.

КОНТЕКСТ УРОКА:
Предмет: ${lessonSubject}
Тема урока: ${lessonTitle}
Описание: ${lessonDesc}
${stageCtx}

Используй этот контекст чтобы давать релевантные подсказки. Отвечай по-русски.`;

  const chatMessages = [
    ...((history ?? []) as Array<{ role: string; content: string }>).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.user_message },
  ];

  const { text, error } = await callGemini(systemPrompt, chatMessages);

  if (error) {
    // Still save the user message so the limit counts it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("ai_chat_messages").insert({
      student_id: student.id,
      lesson_id: body.lesson_id,
      stage_id: body.stage_id ?? null,
      role: "user",
      content: body.user_message,
    });
    return NextResponse.json({ error }, { status: 500 });
  }

  // Save both messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).from("ai_chat_messages").insert([
    {
      student_id: student.id,
      lesson_id: body.lesson_id,
      stage_id: body.stage_id ?? null,
      role: "user",
      content: body.user_message,
    },
    {
      student_id: student.id,
      lesson_id: body.lesson_id,
      stage_id: body.stage_id ?? null,
      role: "assistant",
      content: text,
    },
  ]);

  const remaining = Math.max(0, DAILY_LIMIT - dayCount - 1);
  return NextResponse.json({ text, remaining });
}
