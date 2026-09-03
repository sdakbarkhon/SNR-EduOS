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
import { AI_TASKS } from "./usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { stageAllowsMedia } from "@/lib/lesson-stage-media";
import { schoolStoragePath } from "@snr/core";

export type StageMediaDecision = {
  need_image: boolean;
  image_prompt: string | null;
  /** Заполнено, только если решение НЕ получено: модель не ответила за все
   *  попытки. Пустое поле означает «модель ответила», в том числе ответила
   *  «картинка не нужна».
   *
   *  22.08.2026, ЗАЧЕМ ЭТО ПОЛЕ. Раньше сбой и честное «не нужна» выглядели
   *  одинаково — обе ветки возвращали need_image: false, и вызывающий помечал
   *  этап обработанным. Отличить «не получилось» от «не потребовалось» было
   *  нечем: поле ошибки у всех этапов пустое. Теперь причина доходит до
   *  вызывающего и попадает в media_error. */
  error?: string | null;
};

// 08.08.2026 — картинка ставится ТОЛЬКО на этапы-объяснения. Раньше решение
// принимал Gemini по описанию, и картинки расползлись по практике, заданиям,
// тестам и внешним сервисам — там они не нужны и только отвлекают. На живых
// данных так было у 45 этапов из 125 с картинками.
//
// 10.08.2026 — правило переехало в lib/lesson-stage-media.ts и теперь общее с
// РЕНДЕРОМ. Пока оно жило только здесь, оно останавливало новые картинки, но
// ничего не говорило про уже существующие: показ выводил всё, что лежит в
// image_url, и практический этап получал картинку во весь экран.

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

/** decideStageMedia: нужна ли этапу картинка — решает
 *  сам Gemini (text-only). При сбое (сеть/парсинг) — безопасный дефолт
 *  "ничего не нужно", НЕ ретраится и НЕ считается провалом backfill'а (это
 *  разведка перед генерацией, а не сама генерация — ретраи 3x по спеке
 *  относятся именно к 3.2/3.3 ниже). generateJSON() внутри уже делает свой
 *  retry на 429/5xx (gemini-client.ts::withRetry). */
export async function decideStageMedia(
  stage: Pick<LessonStage, "title" | "description" | "content_type">,
  lessonContext: LessonContextForMedia,
): Promise<StageMediaDecision> {
  // Не объяснение — картинка не нужна, Gemini даже не спрашиваем: это
  // экономит вызов и делает правило жёстким, а не «как решит модель».
  if (!stageAllowsMedia(stage.content_type)) {
    return { need_image: false, image_prompt: null };
  }

  const prompt = `Урок: ${lessonContext.subject} для ${lessonContext.grade} класса
Тема урока: ${lessonContext.lesson_title}
Название этапа: ${stage.title}
Описание этапа: ${stage.description ?? "—"}
Тип этапа: ${stage.content_type ?? "—"}

Реши нужна ли этому этапу картинка:
- Картинка нужна если этап описывает физический объект (робот, компонент, устройство), визуальный концепт (архитектура системы, интерфейс), или демонстрирует результат (собранная схема, работающая программа)

Если этап явно текстовый/обсуждение без визуальных концептов — false.

ТРЕБОВАНИЯ К image_prompt (08.08.2026 — прежняя формулировка давала абстракцию:
на этапе «Что такое ЖК-дисплей» рисовался размытый прямоугольник с жёлтыми
палками вместо дисплея):
- НАЧНИ с конкретного существительного — что именно на картинке. Не «концепция
  отображения информации», а «16x2 character LCD display module».
- Опиши узнаваемые детали предмета: форма, из чего состоит, что видно.
- Робототехника: называй реальные компоненты — Arduino Uno board, HC-SR04
  ultrasonic sensor, servo motor, breadboard with jumper wires, LCD module,
  DC motor with wheel.
- Программирование: называй схему или интерфейс — flowchart of a loop, code
  editor window, array of boxes with indices, nested folder tree.
- ЗАПРЕЩЕНО: слова abstract, conceptual, symbolic, artistic, futuristic,
  glowing, ethereal и любые метафоры вместо предмета.
- Один предмет крупным планом, не коллаж из нескольких сцен.

Верни ТОЛЬКО JSON без markdown, ровно такой формы (пустая строка "" вместо null, если need_image — false):
{ "need_image": boolean, "image_prompt": "английский промпт: конкретное существительное + узнаваемые детали предмета, по требованиям выше" }`;

  // 22.08.2026 — ПОВТОРЫ. Раньше одного неудачного ответа хватало, чтобы этап
  // остался без картинки навсегда: ветка возвращала «не нужна», вызывающий
  // помечал этап обработанным, и второго захода не случалось никогда —
  // страховочный крон снят в августе. Теперь тот же приём, что уже работает
  // у самой генерации картинки ниже: три попытки, паузы 2 и 4 секунды.
  //
  // Своего повтора на сетевые сбои и перегрузку модели здесь заводить не
  // нужно — generateJSON внутри уже повторяет на 429 и 5xx
  // (gemini-client::withRetry). Этот слой ловит то, что тот слой пропускает:
  // ответ пришёл, но разобрать его не удалось.
  let lastError = "decideStageMedia failed";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await generateJSON<{
      need_image?: boolean;
      image_prompt?: string;
    }>(prompt, null, {
      temperature: 0.4,
      usage: { task: AI_TASKS.stageImage },
    });

    if (data && !error) {
      return {
        need_image: data.need_image === true && !!data.image_prompt?.trim(),
        image_prompt: data.image_prompt?.trim() || null,
        error: null,
      };
    }

    lastError = error || "пустой ответ модели";
    if (attempt < MAX_RETRIES - 1) {
      const delay = IMAGE_BASE_DELAY_MS * 2 ** attempt; // 2 с, 4 с
      console.warn(
        `[stage-media-prompts] decideStageMedia попытка ${attempt + 1}/${MAX_RETRIES} не удалась, повтор через ${delay} мс:`,
        lastError,
      );
      await sleep(delay);
    }
  }

  // Все попытки исчерпаны. Картинку не заказываем — но и молчать больше не
  // будем: причина уходит наверх и попадёт в media_error.
  console.warn("[stage-media-prompts] decideStageMedia: попытки исчерпаны:", lastError);
  return { need_image: false, image_prompt: null, error: `decide: ${lastError}` };
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

/**
 * ОДИН РИСОВАЛЬЩИК НА ДВА МЕСТА. 04.09.2026.
 *
 * Открыто наружу без единого изменения поведения: этой же функцией теперь
 * рисуются картинки СЛАЙДОВ (lib/ai-imagen.ts). До сегодня слайды шли в
 * Pollinations, потому что рядом стоял гейт на Imagen, которого на ключе нет
 * вовсе (проверено перечнем моделей: семейства imagen-* ноль). Заводить
 * второй вызов того же эндпоинта ради этого нельзя — в этом проекте копии
 * расходились семь раз.
 *
 * Картинки этапов от переезда не меняются: тело функции то же, вызывающий у
 * них тот же.
 */
export async function tryGeminiImage(styledPrompt: string, apiKey: string): Promise<Buffer> {
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

  const styledPrompt = `Clear, realistic educational illustration of a single concrete subject, drawn accurately and recognisably, correct proportions, sharp well-defined edges, plain light neutral background, subject centred and filling most of the frame, no text, no letters, no numbers, no labels, no watermark, no abstract shapes, no decorative blobs. Subject: ${image_prompt.trim()}`;

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

// Signed URL практически навсегда (bucket приватный — обычный publicUrl не
// отдаёт файл без токена). Один раз выписывается при загрузке и сохраняется
// в lesson_stages.image_url, повторной генерации при каждом рендере не
// требуется.
const SIGNED_URL_TTL_SECONDS = 10 * 365 * 24 * 60 * 60; // 10 лет

/**
 * Загрузить картинку в ЗАКРЫТЫЙ бакет и вернуть подписанную ссылку.
 *
 * 22.08.2026 — ОБЩИЙ СПОСОБ ДЛЯ ОБЕИХ КАРТИНОК. Картинок в проекте две:
 * одна на этап (бакет lesson-stage-images) и одна внутри слайда (бакет
 * slide-images). Первая всегда сохранялась подписанной ссылкой и работала.
 * Вторая брала ПУБЛИЧНЫЙ адрес — а бакет slide-images закрыт с 13.08.2026
 * (миграция 195), и такой адрес отдаёт «Bucket not found». Файл при этом
 * лежал в хранилище: модель отработала, деньги потрачены, на экране пусто.
 *
 * Теперь способ один на обе. Заводить второй нельзя: разойдутся ровно так же.
 */
export async function uploadImageAndSign(
  bucket: string,
  path: string,
  imageBuffer: Buffer,
  opts?: { upsert?: boolean },
): Promise<string> {
  const admin = createAdminClient();

  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(path, imageBuffer, { contentType: "image/png", upsert: opts?.upsert ?? true });
  if (upErr) throw new Error(`upload в ${bucket}: ${upErr.message}`);

  const { data: signed, error: signErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    throw new Error(`подпись ссылки в ${bucket}: ${signErr?.message ?? "ссылка не выдана"}`);
  }
  return signed.signedUrl;
}

/** uploadStageImageToStorage: загрузка в приватный bucket lesson-stage-images
 *  (миграция 165), путь `${stageId}.png`, возвращает signed URL. */
export async function uploadStageImageToStorage(
  imageBuffer: Buffer,
  stageId: string,
  schoolId: string,
): Promise<string> {
  // Школа передаётся аргументом: под служебным ключом current_school_id()
  // пуст, а путь обязан начинаться со школы (миграции 188/189).
  const path = schoolStoragePath(schoolId, `${stageId}.png`);
  return uploadImageAndSign("lesson-stage-images", path, imageBuffer);
}
