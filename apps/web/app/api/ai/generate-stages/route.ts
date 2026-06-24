import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/ai-gemini";

type StageType = "theory" | "code" | "quiz_qia" | "quiz_kahoot";

function buildGeneratePrompt(
  topic: string,
  grade: number,
  stageTypes: StageType[],
  quizCount: number,
  kahootCount: number,
): string {
  const typeDefs: string[] = [];

  if (stageTypes.includes("theory")) {
    typeDefs.push(`ДЛЯ ТЕОРИИ (theory + presentation):
{
  "stage_type": "theory",
  "content_type": "presentation",
  "title": "Краткое название этапа",
  "description": "Развёрнутый текст теории для школьников. Дружелюбный язык, примеры, аналогии. 200-400 слов."
}`);
  }

  if (stageTypes.includes("code")) {
    typeDefs.push(`ДЛЯ ПРОГРАММИРОВАНИЯ (task + code):
{
  "stage_type": "task",
  "content_type": "code",
  "title": "Название задачи",
  "description": "Условие задачи для школьников",
  "config": {
    "language": "python",
    "starter_code": "Код-заготовка с комментариями TODO",
    "expected_output": "Что должна вывести программа на тестовых данных"
  }
}`);
  }

  if (stageTypes.includes("quiz_qia")) {
    typeDefs.push(`ДЛЯ ТЕСТА (task + quiz_qia):
{
  "stage_type": "task",
  "content_type": "quiz_qia",
  "title": "Название теста",
  "description": "Краткая инструкция",
  "config": {
    "time_limit_minutes": null,
    "points_per_question": 1
  },
  "questions": [
    {
      "question_text": "Текст вопроса",
      "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
      "correct_option_index": 0
    }
  ]
}
Создай ровно ${quizCount} вопросов для теста.`);
  }

  if (stageTypes.includes("quiz_kahoot")) {
    typeDefs.push(`ДЛЯ KAHOOT (task + quiz_kahoot):
{
  "stage_type": "task",
  "content_type": "quiz_kahoot",
  "title": "Название игры",
  "description": "Краткая инструкция",
  "questions": [
    {
      "question_text": "Текст вопроса",
      "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
      "correct_option_index": 0,
      "time_per_question_seconds": 15
    }
  ]
}
Создай ровно ${kahootCount} вопросов для Kahoot.`);
  }

  return `Ты — методист, помогаешь учителю составить урок для школьников ${grade} класса.

Тема урока: ${topic}

Создай этапы урока ТОЛЬКО следующих типов: ${stageTypes.join(", ")}.

Для КАЖДОГО этапа сгенерируй данные в строгом JSON формате:

${typeDefs.join("\n\n")}

ПРАВИЛА:
- Контент адекватен ${grade} классу
- Тон дружелюбный, можно эмодзи
- Никакой политики, насилия, взрослого контента
- Программирование: простые задачи на 20-30 минут для школьника
- Квизы: вопросы по теме с правильным ответом и 3 ясно неправильных варианта

ВЕРНИ JSON-объект следующей структуры:
{
  "lesson_title_suggestion": "...",
  "lesson_description_suggestion": "...",
  "stages": [ ... массив этапов ... ]
}

ВАЖНО: верни ТОЛЬКО валидный JSON, без markdown-обёрток, без комментариев.`;
}

function validateStages(stages: unknown[]): boolean {
  const allowed = ["theory", "task"];
  const allowedContent = [
    "presentation", "code", "quiz_qia", "quiz_kahoot",
  ];
  for (const s of stages) {
    const stage = s as Record<string, unknown>;
    if (!allowed.includes(stage.stage_type as string)) return false;
    if (stage.content_type && !allowedContent.includes(stage.content_type as string)) return false;
    if (!stage.title || typeof stage.title !== "string") return false;
    if (stage.content_type === "code") {
      const cfg = stage.config as Record<string, unknown> | undefined;
      if (!cfg?.language || !cfg?.starter_code) return false;
    }
    if (stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot") {
      if (!Array.isArray(stage.questions) || stage.questions.length === 0) return false;
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify teacher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const body = (await req.json()) as {
    lesson_id: string;
    topic: string;
    grade: number;
    stage_types: StageType[];
    quiz_questions_count?: number;
    kahoot_questions_count?: number;
  };

  // Verify teacher owns the lesson via groups (lessons has no teacher_id column)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson } = await (db as any)
    .from("lessons")
    .select("group:groups!inner(teacher_id)")
    .eq("id", body.lesson_id)
    .single();
  const ownerTeacherId = (lesson?.group as { teacher_id: string } | null)?.teacher_id;
  if (!lesson || ownerTeacherId !== teacher.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!body.topic?.trim() || !body.stage_types?.length) {
    return NextResponse.json({ error: "Missing topic or stage_types" }, { status: 400 });
  }

  const quizCount = body.quiz_questions_count ?? 5;
  const kahootCount = body.kahoot_questions_count ?? 5;
  const prompt = buildGeneratePrompt(body.topic, body.grade ?? 7, body.stage_types, quizCount, kahootCount);

  type GenerateResult = { lesson_title_suggestion: string; lesson_description_suggestion: string; stages: unknown[] };

  // Call Gemini with JSON mode; retry up to 2 times on parse failure
  let result: GenerateResult | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    const { text, error } = await callGemini(
      prompt,
      [],
      { temperature: 0.8, responseMimeType: "application/json" },
    );

    if (error) { lastError = error; continue; }

    try {
      const parsed = JSON.parse(text) as GenerateResult;
      if (Array.isArray(parsed?.stages) && validateStages(parsed.stages)) {
        result = parsed;
      } else {
        lastError = "Generated stages failed validation";
      }
    } catch {
      lastError = "Generated JSON parse error";
    }
  }

  if (!result) {
    return NextResponse.json({ error: lastError || "Generation failed" }, { status: 500 });
  }

  return NextResponse.json(result);
}
