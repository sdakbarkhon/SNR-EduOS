import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai-claude";
import { extractText } from "@/lib/file-extractors";

// Промт 4, Часть 3 — парсит PDF/DOCX учебный план в список тем через AI.
// НЕ пишет в БД — учитель подтверждает/редактирует темы на клиенте, запись
// происходит отдельно через createCurriculumPlan при "Сохранить план".

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 МБ — тот же лимит, что Storage bucket curriculum-plans
const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_TOPICS = 40;

type ParsedTopic = { title: string; description: string | null; estimated_lessons: number };

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isPdfOrDocx(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === ALLOWED_MIME[1] || name.endsWith(".docx")) return "docx";
  return null;
}

function buildPrompt(planText: string): string {
  return `Ты — методический ассистент для учителя в школе Узбекистана.

Раскладай текст учебного плана на упорядоченный список тем в порядке следования.
Верни СТРОГО JSON массив (без markdown, без пояснений вне JSON), формат:
[{"title": "...", "description": "...", "estimated_lessons": 1}, ...]

ПРАВИЛА:
- title — короткое название темы (на русском).
- description — 1-2 предложения, что именно изучается в теме (может быть пустой строкой, если в плане нет деталей).
- estimated_lessons — целое число уроков на тему (по умолчанию 1, если план явно не указывает больше).
- Порядок массива = порядок следования тем в плане.
- Максимум ${MAX_TOPICS} тем — если тем в плане больше, объедини близкие по смыслу.
- Если в тексте нет явной структуры (нумерации/заголовков) — определи темы по смыслу самостоятельно, разбив содержание на логические блоки.
- Только валидный JSON, ничего больше.

ТЕКСТ УЧЕБНОГО ПЛАНА:
${planText}`;
}

export async function POST(req: NextRequest) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const groupId = form.get("group_id");
  const subjectId = form.get("subject_id");

  if (!(file instanceof File) || typeof groupId !== "string" || typeof subjectId !== "string" || !groupId || !subjectId) {
    return NextResponse.json({ error: "file, group_id, subject_id required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Файл больше 20 МБ" }, { status: 400 });
  }
  const kind = isPdfOrDocx(file);
  if (!kind) {
    return NextResponse.json({ error: "Разрешены только PDF и DOCX файлы" }, { status: 400 });
  }

  // Куратор группы — та же проверка, что RLS curriculum_plans_insert
  // (can_manage_curriculum_plan): парсинг не пишет в БД, но уже тратит
  // реальные AI-токены, поэтому не должен быть открыт произвольному учителю.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: group } = await (db as any)
    .from("groups").select("id, teacher_id").eq("id", groupId).maybeSingle();
  if (!group || group.teacher_id !== teacher.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let planText: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractText(buffer, file.type, file.name);
    planText = extracted.text;
  } catch {
    return NextResponse.json({ error: "Не удалось извлечь текст из файла" }, { status: 400 });
  }
  if (!planText.trim()) {
    return NextResponse.json({ error: "Файл пуст или не удалось извлечь текст" }, { status: 400 });
  }

  const prompt = buildPrompt(planText);
  let lastError: string | null = null;
  let topics: ParsedTopic[] | null = null;

  for (let attempt = 0; attempt < 3 && !topics; attempt++) {
    const { text, error } = await callClaude(prompt, []);
    if (error) { lastError = error; continue; }
    try {
      const parsed = JSON.parse(stripFences(text));
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
      topics = parsed.slice(0, MAX_TOPICS).map((t: Partial<ParsedTopic>) => ({
        title: String(t.title ?? "").trim() || "Без названия",
        description: t.description ? String(t.description).trim() : null,
        estimated_lessons: Number.isFinite(t.estimated_lessons) && Number(t.estimated_lessons) > 0
          ? Math.round(Number(t.estimated_lessons))
          : 1,
      }));
    } catch {
      lastError = "Не удалось разобрать ответ AI";
    }
  }

  if (!topics) {
    return NextResponse.json({ error: lastError || "Не удалось распарсить план" }, { status: 500 });
  }

  return NextResponse.json({ topics, sourceFileType: kind });
}
