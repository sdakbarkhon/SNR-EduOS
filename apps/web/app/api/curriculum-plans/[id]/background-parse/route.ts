import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { buildCurriculumParsePrompt } from "@/lib/ai/prompts";
import { CURRICULUM_TOPICS_SCHEMA } from "@/lib/ai/schemas";
import { extractText, mimeFromName } from "@/lib/file-extractors";
import { updateCurriculumPlanProgress, markCurriculumPlanReady, markCurriculumPlanError } from "@snr/core";

// Большой фикс, Блок 6, ЗАДАЧА 1 — фоновый воркер парсинга учебного плана.
// Триггерится fire-and-forget'ом из create-processing/route.ts (или
// retry-parse/route.ts) — ОТДЕЛЬНЫЙ serverless-вызов, не await'ится
// вызывающей стороной, поэтому переживает закрытие вкладки учителем.
// Не сессионный (никаких куки от браузера) — авторизация через тот же
// CRON_SECRET, что Vercel Cron (apps/web/app/api/cron/*), переиспользован
// как общий "доверенный внутренний вызов" секрет, не заводим отдельный.

export const runtime = "nodejs";
// 07.08.2026: было 60 — и этого НЕ ХВАТАЛО. Живой прогон на реальном файле
// учителя (Робототехника 3-А) занял 65 секунд: скачивание из Storage +
// извлечение текста + до 3 попыток generateJSON с ретраями внутри
// gemini-client. На Vercel функция была бы убита на 60-й секунде ПОСЛЕ того,
// как progress уже сдвинулся на 30/60 — то есть план снова завис бы, просто
// на другом проценте, и снова без error_message (catch не успевает
// отработать при принудительном завершении). 300 — потолок Hobby-плана через
// Fluid Compute, тот же, что уже стоит у /api/cron/rag-process-queue и
// /api/stage-media/generate.
export const maxDuration = 300;

const MAX_TOPICS = 40;
type ParsedTopic = { title: string; description: string | null; estimated_lessons: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const { data: plan, error: planErr } = await anyDb
    .from("curriculum_plans")
    .select("id, source_file_url, status")
    .eq("id", planId)
    .maybeSingle();
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  // Идемпотентно: если план уже не 'processing' (готов/ошибка от прошлого
  // вызова, или дублирующий триггер), второй раз не парсим.
  if (plan.status !== "processing") return NextResponse.json({ ok: true, skipped: true });

  try {
    if (!plan.source_file_url) throw new Error("У плана нет файла");

    await updateCurriculumPlanProgress(db, planId, 30);
    const { data: fileData, error: dlErr } = await db.storage.from("curriculum-plans").download(plan.source_file_url);
    if (dlErr || !fileData) throw new Error("Не удалось скачать файл плана");
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const extracted = await extractText(buffer, mimeFromName(plan.source_file_url), plan.source_file_url);
    const planText = extracted.text;
    if (!planText.trim()) throw new Error("Файл пуст или не удалось извлечь текст");

    await updateCurriculumPlanProgress(db, planId, 60);
    const prompt = buildCurriculumParsePrompt(planText, MAX_TOPICS);
    let topics: ParsedTopic[] | null = null;
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3 && !topics; attempt++) {
      const { data: parsed, error } = await generateJSON<Partial<ParsedTopic>[]>(prompt, CURRICULUM_TOPICS_SCHEMA, {
        model: "pro",
        usage: { task: AI_TASKS.curriculumParse },
      });
      if (error || !Array.isArray(parsed) || parsed.length === 0) {
        lastError = error || "Не удалось разобрать ответ AI";
        continue;
      }
      topics = parsed.slice(0, MAX_TOPICS).map((t) => ({
        title: String(t.title ?? "").trim() || "Без названия",
        description: t.description ? String(t.description).trim() : null,
        estimated_lessons: Number.isFinite(t.estimated_lessons) && Number(t.estimated_lessons) > 0
          ? Math.round(Number(t.estimated_lessons))
          : 1,
      }));
    }
    if (!topics) throw new Error(lastError || "Не удалось распарсить план");

    await updateCurriculumPlanProgress(db, planId, 90);
    await markCurriculumPlanReady(
      db,
      planId,
      topics.map((t) => ({ title: t.title, description: t.description, estimatedLessons: t.estimated_lessons })),
    );

    return NextResponse.json({ ok: true, topicsCount: topics.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка парсинга";
    await markCurriculumPlanError(db, planId, message).catch(() => null);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
