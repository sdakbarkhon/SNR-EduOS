// Server-side only. Заказчик 05.08.2026 — AI-медиа для этапов уроков
// Programming/Robotics (backfill, см. apps/web/scripts/backfill-stage-media-
// jul29-aug1.mjs). Это TS-версия для переиспользования внутри Next.js-кода
// (будущая автогенерация на новые этапы, "Перезапустить" на failed) —
// backfill-скрипт сам по себе .mjs и не может импортировать .ts напрямую, у
// него отдельная зеркальная копия этой логики (тот же паттерн, что уже
// использует fill-grade-comments.mjs для generativelanguage.googleapis.com,
// а не lib/ai/gemini-client.ts).
import type { LessonStage } from "@snr/core";
import { generateJSON, generateText } from "./gemini-client";
import { createAdminClient } from "@/lib/supabase/admin";

export type StageMediaDecision = {
  need_image: boolean;
  image_prompt: string | null;
  need_mermaid: boolean;
  mermaid_prompt: string | null;
};

export type LessonContextForMedia = {
  subject: string;
  grade: number;
  lesson_title: string;
};

const MAX_RETRIES = 3;
const IMAGE_BASE_DELAY_MS = 2000; // 2s, 4s, 8s — как в спеке для картинок

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** decideStageMedia: нужна ли этапу картинка и/или mermaid-схема — решает
 *  сам Gemini (text-only). При сбое (сеть/парсинг) — безопасный дефолт
 *  "ничего не нужно", НЕ ретраится и НЕ считается провалом backfill'а (это
 *  разведка перед генерацией, а не сама генерация — ретраи 3x по спеке
 *  относятся именно к 3.2/3.3 ниже). generateJSON() внутри уже делает свой
 *  retry на 429/5xx (gemini-client.ts::withRetry). */
export async function decideStageMedia(
  stage: Pick<LessonStage, "title" | "description" | "content_type">,
  lessonContext: LessonContextForMedia,
): Promise<StageMediaDecision> {
  const prompt = `Урок: ${lessonContext.subject} для ${lessonContext.grade} класса
Тема урока: ${lessonContext.lesson_title}
Название этапа: ${stage.title}
Описание этапа: ${stage.description ?? "—"}
Тип этапа: ${stage.content_type ?? "—"}

Реши нужна ли этому этапу картинка и/или блок-схема алгоритма:
- Картинка нужна если этап описывает физический объект (робот, компонент, устройство), визуальный концепт (архитектура системы, интерфейс), или демонстрирует результат (собранная схема, работающая программа)
- Блок-схема mermaid нужна если этап описывает алгоритм, последовательность шагов, условную логику, цикл

Если этап явно текстовый/обсуждение без визуальных концептов — оба false.

Верни ТОЛЬКО JSON без markdown, ровно такой формы (пустая строка "" вместо null, если соответствующее need_* — false):
{ "need_image": boolean, "image_prompt": "англ. промпт для генерации картинки, детальный, стиль минималистичная образовательная иллюстрация с чистым фоном, без текста на картинке", "need_mermaid": boolean, "mermaid_prompt": "русский текст описывающий что должна показывать блок-схема" }`;

  const { data, error } = await generateJSON<{
    need_image?: boolean;
    image_prompt?: string;
    need_mermaid?: boolean;
    mermaid_prompt?: string;
  }>(prompt, null, { temperature: 0.4 });

  if (error || !data) {
    console.warn("[stage-media-prompts] decideStageMedia failed, defaulting to no media:", error);
    return { need_image: false, image_prompt: null, need_mermaid: false, mermaid_prompt: null };
  }

  return {
    need_image: data.need_image === true && !!data.image_prompt?.trim(),
    image_prompt: data.image_prompt?.trim() || null,
    need_mermaid: data.need_mermaid === true && !!data.mermaid_prompt?.trim(),
    mermaid_prompt: data.mermaid_prompt?.trim() || null,
  };
}

// Спека называла "gemini-2.5-flash-image-preview" — этот id 404-ит
// ("is not found"), проверено живым запросом. Реальный доступный id (см.
// ListModels) без суффикса -preview.
const IMAGE_MODEL = "gemini-2.5-flash-image";
const IMAGE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
    };
  }>;
};

export type StageImageResult = { buffer: Buffer; source: "gemini" | "pollinations" };

async function tryGeminiImage(styledPrompt: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(`${IMAGE_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: styledPrompt }] }] }),
    // Короткий таймаут — реальные провалы это быстрые 503, зависший fetch
    // (исчерпание connection pool у undici на долгоживущем процессе) должен
    // обрываться быстро, не копить зависшие сокеты.
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as GeminiImageResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(`No inline image data in response: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function tryPollinationsImage(styledPrompt: string): Promise<Buffer> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=1024&height=576&nologo=true`;
  // 45s — живым замером подтверждено, что успешная генерация Pollinations
  // занимает 10-20s под нагрузкой; короткий общий таймаут (было 20s) обрубал
  // легитимные запросы и заваливал failure-rate backfill'а.
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** generateStageImage: Gemini 2.5 Flash Image ("Nano Banana"), 3 попытки,
 *  backoff 2s/4s/8s — по спеке 3.2. 05.08.2026, по ходу backfill'а gemini-
 *  2.5-flash-image словил устойчивый HTTP 503 "high demand" — добавлен
 *  fallback на Pollinations.ai (1 попытка, тот же провайдер, что уже
 *  использует apps/web/lib/ai-imagen.ts для слайдов) при полном исчерпании
 *  ретраев Gemini. Бросает только если ОБА провайдера не сработали. */
export async function generateStageImage(image_prompt: string): Promise<StageImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing on server");

  const styledPrompt = `Academic educational illustration, minimalist clean style, soft colors, no text labels, no watermark. ${image_prompt.trim()}`;

  let lastError = "generateStageImage failed";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const buffer = await tryGeminiImage(styledPrompt, apiKey);
      return { buffer, source: "gemini" };
    } catch (e) {
      lastError = `gemini: ${(e as Error)?.message || lastError}`;
      if (attempt < MAX_RETRIES - 1) {
        const delay = IMAGE_BASE_DELAY_MS * 2 ** attempt; // 2s, 4s
        console.warn(`[stage-media-prompts] generateStageImage attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${delay}ms:`, lastError);
        await sleep(delay);
      }
    }
  }

  console.warn(`[stage-media-prompts] Gemini image exhausted, trying Pollinations fallback: ${lastError}`);
  try {
    const buffer = await tryPollinationsImage(styledPrompt);
    return { buffer, source: "pollinations" };
  } catch (e) {
    throw new Error(`${lastError} | pollinations: ${(e as Error)?.message}`);
  }
}

function stripMermaidFences(text: string): string {
  return text.replace(/^```mermaid\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

/** generateMermaidCode: Gemini 2.5 Flash text-only (через gemini-client.ts —
 *  тот же resolveModel() всегда возвращает Flash). Собственный retry-цикл
 *  ловит именно "модель ответила, но не валидным mermaid" — отдельный класс
 *  ошибки от транспортных 429/5xx, которые уже ретраит withRetry() внутри
 *  generateText(). 3 попытки — по спеке 3.3. */
export async function generateMermaidCode(
  mermaid_prompt: string,
  stage_context: { grade: number },
): Promise<string> {
  const prompt = `Сгенерируй код блок-схемы mermaid для образовательной цели.
Контекст: ${mermaid_prompt}
Класс: ${stage_context.grade}

Требования:
- Только валидный mermaid flowchart-синтаксис (graph TD или graph LR)
- Не больше 8 узлов
- Все подписи на русском
- Никаких других объяснений — только код mermaid, начинающийся с "graph TD" или "graph LR"`;

  let lastError = "generateMermaidCode failed";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { text, error } = await generateText(prompt, { temperature: 0.4 });
    if (!error && text.trim()) {
      const code = stripMermaidFences(text.trim());
      if (/^graph (TD|LR)\b/.test(code)) return code;
      lastError = `Invalid mermaid output: ${code.slice(0, 200)}`;
    } else {
      lastError = error || "empty response";
    }
    if (attempt < MAX_RETRIES - 1) {
      const delay = IMAGE_BASE_DELAY_MS * 2 ** attempt;
      console.warn(`[stage-media-prompts] generateMermaidCode attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${delay}ms:`, lastError);
      await sleep(delay);
    }
  }
  throw new Error(lastError);
}

// Signed URL практически навсегда (bucket приватный — обычный publicUrl не
// отдаёт файл без токена). Один раз выписывается при загрузке и сохраняется
// в lesson_stages.image_url, повторной генерации при каждом рендере не
// требуется.
const SIGNED_URL_TTL_SECONDS = 10 * 365 * 24 * 60 * 60; // 10 лет

/** uploadStageImageToStorage: загрузка в приватный bucket lesson-stage-images
 *  (миграция 165), путь `${stageId}.png`, возвращает signed URL. */
export async function uploadStageImageToStorage(imageBuffer: Buffer, stageId: string): Promise<string> {
  const admin = createAdminClient();
  const path = `${stageId}.png`;

  const { error: upErr } = await admin.storage
    .from("lesson-stage-images")
    .upload(path, imageBuffer, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`uploadStageImageToStorage upload: ${upErr.message}`);

  const { data: signed, error: signErr } = await admin.storage
    .from("lesson-stage-images")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    throw new Error(`uploadStageImageToStorage sign: ${signErr?.message ?? "no signedUrl"}`);
  }
  return signed.signedUrl;
}
