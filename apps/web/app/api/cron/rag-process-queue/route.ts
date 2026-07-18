// Пачка 5.1 — Vercel Cron (каждые 5 мин, см. vercel.json): обрабатывает
// lesson_stages_embedding_queue — считает эмбеддинги и пишет их в
// lesson_stage_embeddings.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeEmbedding } from "@/lib/ai/embeddings";

const BATCH_LIMIT = 20;
const MAX_ATTEMPTS = 3;
const INTER_CALL_DELAY_MS = 500;

// ~500 токенов ≈ 2000 символов (грубая эвристика "1 токен ≈ 4 символа",
// та же, что используется в проекте — см. промт задачи). Режем по
// параграфам (пустая строка), при переполнении — по предложениям.
const MAX_CHUNK_CHARS = 2000;

function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= MAX_CHUNK_CHARS) return [trimmed];

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  }

  for (const para of paragraphs) {
    if (para.length > MAX_CHUNK_CHARS) {
      // Абзац сам по себе больше лимита — режем по предложениям.
      pushCurrent();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";
      for (const sentence of sentences) {
        if ((sentenceChunk + " " + sentence).length > MAX_CHUNK_CHARS && sentenceChunk) {
          chunks.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
        }
      }
      if (sentenceChunk.trim()) chunks.push(sentenceChunk.trim());
      continue;
    }
    if ((current + "\n\n" + para).length > MAX_CHUNK_CHARS && current) {
      pushCurrent();
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  pushCurrent();
  return chunks;
}

type SlideJson = { title?: string; content?: string };

/** Текст этапа зависит от stage_role — lesson_stages не имеет колонки
 *  content вообще (см. миграцию 139): theory — конкатенация slides[],
 *  practice — description+teacher_notes, quiz_qia — вопросы/варианты
 *  из ОТДЕЛЬНОЙ таблицы quiz_questions (передаются отдельно). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStageText(stage: any, quizQuestions: Array<{ question_text: string; options: string[] }>): string {
  if (stage.stage_role === "theory") {
    const slides = (stage.slides as SlideJson[] | null) ?? [];
    return slides.map((s) => `${s.title ?? ""}\n${s.content ?? ""}`).join("\n\n").trim();
  }
  if (stage.stage_role === "practice") {
    return [stage.description, stage.teacher_notes].filter(Boolean).join("\n\n").trim();
  }
  if (stage.stage_role === "quiz_qia") {
    // Без correct_option_index — retrieval-контекст не должен палить
    // правильные ответы (та же логика, что уже в /api/ai/chat/route.ts
    // для lesson-чата).
    return quizQuestions
      .map((q, i) => `Вопрос ${i + 1}: ${q.question_text}\nВарианты: ${(q.options ?? []).join(", ")}`)
      .join("\n\n");
  }
  return "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  // lesson_stage_embeddings / lesson_stages_embedding_queue — новые таблицы
  // из миграции 139, которая ещё не применена к БД, поэтому их нет в
  // сгенерированном Database-типе (@snr/core). Тот же as-any приём, что
  // уже используется в packages/core для lesson_materials video-колонок
  // (миграция 138, до regen типов).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragDb = db as any;

  const { data: queueRows, error: queueErr } = await ragDb
    .from("lesson_stages_embedding_queue")
    .select("lesson_stage_id, school_id, attempts")
    .lt("attempts", MAX_ATTEMPTS)
    .order("enqueued_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (queueErr) return NextResponse.json({ error: queueErr.message }, { status: 500 });

  const results = { processed: 0, embedded_chunks: 0, errors: 0 };

  for (const row of queueRows ?? []) {
    try {
      const { data: stage, error: stageErr } = await db
        .from("lesson_stages")
        .select("id, stage_role, stage_type, slides, description, teacher_notes, school_id")
        .eq("id", row.lesson_stage_id)
        .single();
      if (stageErr || !stage) throw new Error(stageErr?.message ?? "stage not found");

      let quizQuestions: Array<{ question_text: string; options: string[] }> = [];
      if (stage.stage_role === "quiz_qia") {
        const { data: questions } = await db
          .from("quiz_questions")
          .select("question_text, options")
          .eq("stage_id", stage.id)
          .order("position");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quizQuestions = (questions ?? []) as any;
      }

      const fullText = extractStageText(stage, quizQuestions);
      const chunks = chunkText(fullText);

      if (chunks.length === 0) {
        // Пусто (например, description/teacher_notes ещё не заполнены) —
        // не ошибка, просто нечего индексировать сейчас. Убираем из
        // очереди — следующий UPDATE, зацепивший триггер, поставит снова.
        await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
        results.processed++;
        continue;
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunkText_ = chunks[i]!; // guarded by i < chunks.length
        const embedding = await computeEmbedding(chunkText_);
        const { error: upsertErr } = await ragDb.from("lesson_stage_embeddings").upsert(
          {
            lesson_stage_id: row.lesson_stage_id,
            chunk_index: i,
            chunk_text: chunkText_,
            embedding,
            school_id: row.school_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "lesson_stage_id,chunk_index" },
        );
        if (upsertErr) throw new Error(upsertErr.message);
        results.embedded_chunks++;
        if (i < chunks.length - 1) await sleep(INTER_CALL_DELAY_MS);
      }

      await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
      results.processed++;
      await sleep(INTER_CALL_DELAY_MS);
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      console.error(`[rag-process-queue] failed for stage ${row.lesson_stage_id}:`, message);
      await ragDb
        .from("lesson_stages_embedding_queue")
        .update({ attempts: row.attempts + 1, last_error: message })
        .eq("lesson_stage_id", row.lesson_stage_id);
      results.errors++;
    }
  }

  return NextResponse.json(results);
}
