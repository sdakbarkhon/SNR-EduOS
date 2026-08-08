#!/usr/bin/env node
// Заказчик 05.08.2026 — AI-медиа (картинки Gemini 2.5 Flash Image + mermaid-
// схемы) для этапов уроков Programming/Robotics за 29.07-01.08.2026.
// Разовый backfill СУЩЕСТВУЮЩИХ этапов — автогенерация на новые этапы не
// подключена (отдельная будущая задача, см. resheniya_2.md).
//
// .mjs не может импортировать apps/web/lib/ai/stage-media-prompts.ts
// напрямую (нет build-шага для TS в этих скриптах) — здесь зеркальная копия
// той же логики в чистом JS, тот же паттерн, что уже использует
// fill-grade-comments.mjs для generativelanguage.googleapis.com вместо
// lib/ai/gemini-client.ts.
//
// ЗАПУСК (из apps/web):
//   node scripts/backfill-stage-media-jul29-aug1.mjs
//   node scripts/backfill-stage-media-jul29-aug1.mjs --retry-failed   (+ ранее failed)

import { GoogleGenerativeAI } from "@google/generative-ai";
import { makeServiceRoleClient, loadEnvLocal } from "./_backfill-shared.mjs";

const RETRY_FAILED = process.argv.includes("--retry-failed");

// 08.08.2026 — принудительная ПЕРЕгенерация. Обычный прогон пропускает всё,
// что уже media_status=generated, поэтому улучшенный промпт (см. ниже) сам по
// себе ничего бы не переделал. --force снимает этот пропуск, но ТОЛЬКО внутри
// узкого окна --only-day: скоуп задачи — один день, чужие картинки не трогаем.
// Без --only-day флаг --force не работает: слишком легко переписать всё.
const FORCE = process.argv.includes("--force");
const onlyDayArg = process.argv.find((a) => a.startsWith("--only-day="));
const ONLY_DAY = onlyDayArg ? onlyDayArg.split("=")[1] : null;
if (FORCE && !ONLY_DAY) {
  console.error("!!! --force требует --only-day=YYYY-MM-DD (защита от переписывания всех дней)");
  process.exit(1);
}

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

const env = loadEnvLocal();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) fail("GEMINI_API_KEY отсутствует в .env.local.");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SUBJECT_NAMES = ["Программирование", "Робототехника"];
const RANGE_FROM = "2026-07-29T00:00:00+05:00";
const RANGE_TO = "2026-08-02T00:00:00+05:00"; // exclusive — покрывает 29.07-01.08 включительно

// Спека называла "gemini-2.5-flash-image-preview" — 404-ит (проверено живым
// запросом). Реальный доступный id (ListModels) без суффикса -preview.
const IMAGE_MODEL = "gemini-2.5-flash-image";
const IMAGE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;
const TEXT_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];

// ── throttle между вызовами Gemini (последовательная обработка, без параллелизма) ──
const MIN_INTERVAL_MS = 2000;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let textModelName = null;
async function pickWorkingTextModel() {
  for (const candidate of TEXT_MODEL_CANDIDATES) {
    try {
      await throttle();
      const model = genAI.getGenerativeModel({ model: candidate });
      await model.generateContent("ping");
      console.log(`  Текстовая модель: ${candidate}`);
      return candidate;
    } catch (e) {
      console.warn(`  модель ${candidate} недоступна: ${(e.message ?? "").split("\n")[0]}`);
    }
  }
  return null;
}

function stripFences(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}
function stripMermaidFences(text) {
  return text.replace(/^```mermaid\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

let geminiCallCount = 0;

// ── decideStageMedia (текстовый Gemini-вызов, без retry-обёртки сверху — при
// провале безопасный дефолт "медиа не нужно", не считается failed-этапом) ──
async function decideStageMedia(stage, lessonContext) {
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
ТРЕБОВАНИЯ К image_prompt (08.08.2026 — прежняя формулировка давала абстракцию:
на этапе «Что такое ЖК-дисплей» рисовался размытый прямоугольник с жёлтыми
палками вместо дисплея). Зеркало требований из lib/ai/stage-media-prompts.ts —
расходиться не должны:
- НАЧНИ с конкретного существительного: не «концепция отображения информации»,
  а «16x2 character LCD display module».
- Опиши узнаваемые детали: форма, из чего состоит, что видно.
- Робототехника: Arduino Uno board, HC-SR04 ultrasonic sensor, servo motor,
  breadboard with jumper wires, LCD module, DC motor with wheel.
- Программирование: flowchart of a loop, code editor window, array of boxes
  with indices, nested folder tree.
- ЗАПРЕЩЕНО: abstract, conceptual, symbolic, artistic, futuristic, glowing,
  ethereal и любые метафоры вместо предмета.
- Один предмет крупным планом, не коллаж.

{ "need_image": boolean, "image_prompt": "английский промпт: конкретное существительное + узнаваемые детали предмета, по требованиям выше", "need_mermaid": boolean, "mermaid_prompt": "русский текст описывающий что должна показывать блок-схема" }`;

  try {
    await throttle();
    geminiCallCount++;
    const model = genAI.getGenerativeModel({
      model: textModelName,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(stripFences(result.response.text()));
    return {
      need_image: parsed.need_image === true && !!parsed.image_prompt?.trim(),
      image_prompt: parsed.image_prompt?.trim() || null,
      need_mermaid: parsed.need_mermaid === true && !!parsed.mermaid_prompt?.trim(),
      mermaid_prompt: parsed.mermaid_prompt?.trim() || null,
    };
  } catch (e) {
    console.warn(`    decideStageMedia failed, defaulting to no media: ${(e.message ?? "").split("\n")[0]}`);
    return { need_image: false, image_prompt: null, need_mermaid: false, mermaid_prompt: null };
  }
}

// Gemini: короткий таймаут — реальные провалы это быстрые 503, а изредка
// зависавший fetch (>45s без ответа, вероятно исчерпание connection pool у
// undici на долгоживущем процессе) должен обрываться быстро, не копить
// зависшие сокеты. Pollinations: живым замером подтверждено, что НОРМАЛЬНАЯ
// успешная генерация занимает 10-20s — 20s таймаут (тот же, что был общим)
// обрубал легитимные, ещё не завершившиеся запросы и заваливал >50%-порог
// скрипта. 45s даёт реальным генерациям время добежать.
const GEMINI_FETCH_TIMEOUT_MS = 20000;
const POLLINATIONS_FETCH_TIMEOUT_MS = 45000;

async function tryGeminiImage(styledPrompt) {
  await throttle();
  geminiCallCount++;
  const res = await fetch(`${IMAGE_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: styledPrompt }] }] }),
    signal: AbortSignal.timeout(GEMINI_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error(`No inline image data: ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function tryPollinationsImage(styledPrompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=1024&height=576&nologo=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(POLLINATIONS_FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── generateStageImage: Gemini 2.5 Flash Image, 3 попытки, backoff 2s/4s/8s,
// затем 1 попытка Pollinations.ai fallback (05.08.2026 — gemini-2.5-flash-
// image словил устойчивый HTTP 503 "high demand" во время реального прогона,
// см. resheniya_2.md). Возвращает { buffer, source }. ──
async function generateStageImage(imagePrompt) {
  const styledPrompt = `Clear, realistic educational illustration of a single concrete subject, drawn accurately and recognisably, correct proportions, sharp well-defined edges, plain light neutral background, subject centred and filling most of the frame, no text, no letters, no numbers, no labels, no watermark, no abstract shapes, no decorative blobs. Subject: ${imagePrompt.trim()}`;
  let lastError = "generateStageImage failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const buffer = await tryGeminiImage(styledPrompt);
      return { buffer, source: "gemini" };
    } catch (e) {
      lastError = `gemini: ${e.message ?? lastError}`;
      if (attempt < 2) {
        const delay = 2000 * 2 ** attempt;
        console.warn(`    generateStageImage попытка ${attempt + 1}/3 провалилась, retry через ${delay}ms: ${lastError.split("\n")[0]}`);
        await sleep(delay);
      }
    }
  }
  console.warn(`    Gemini image исчерпан, пробуем Pollinations fallback: ${lastError.split("\n")[0]}`);
  try {
    const buffer = await tryPollinationsImage(styledPrompt);
    return { buffer, source: "pollinations" };
  } catch (e) {
    throw new Error(`${lastError} | pollinations: ${e.message}`);
  }
}

// ── generateMermaidCode: Gemini 2.5 Flash text-only, 3 попытки ──
async function generateMermaidCode(mermaidPrompt, grade) {
  const prompt = `Сгенерируй код блок-схемы mermaid для образовательной цели.
Контекст: ${mermaidPrompt}
Класс: ${grade}

Требования:
- Только валидный mermaid flowchart-синтаксис (graph TD или graph LR)
- Не больше 8 узлов
- Все подписи на русском
- Никаких других объяснений — только код mermaid, начинающийся с "graph TD" или "graph LR"`;

  let lastError = "generateMermaidCode failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await throttle();
      geminiCallCount++;
      const model = genAI.getGenerativeModel({ model: textModelName });
      const result = await model.generateContent(prompt);
      const code = stripMermaidFences(result.response.text().trim());
      if (/^graph (TD|LR)\b/.test(code)) return code;
      throw new Error(`Invalid mermaid output: ${code.slice(0, 200)}`);
    } catch (e) {
      lastError = e.message ?? lastError;
      if (attempt < 2) {
        const delay = 2000 * 2 ** attempt;
        console.warn(`    generateMermaidCode попытка ${attempt + 1}/3 провалилась, retry через ${delay}ms: ${lastError.split("\n")[0]}`);
        await sleep(delay);
      }
    }
  }
  throw new Error(lastError);
}

const SIGNED_URL_TTL_SECONDS = 10 * 365 * 24 * 60 * 60; // 10 лет

async function uploadStageImageToStorage(imageBuffer, stageId) {
  const path = `${stageId}.png`;
  const { error: upErr } = await db.storage
    .from("lesson-stage-images")
    .upload(path, imageBuffer, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);

  const { data: signed, error: signErr } = await db.storage
    .from("lesson-stage-images")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) throw new Error(`sign: ${signErr?.message ?? "no signedUrl"}`);
  return signed.signedUrl;
}

function gradeFromGroupName(name) {
  const m = (name ?? "").match(/(\d{1,2})/);
  const g = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(g) ? g : 7;
}

async function main() {
  console.log("Backfill AI-медиа этапов: Programming+Robotics, 29.07-01.08.2026\n");

  const { data: subjects, error: subjErr } = await db.from("subjects").select("id, name").in("name", SUBJECT_NAMES);
  if (subjErr) fail(`subjects: ${subjErr.message}`);
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

  const { data: lessons, error: lesErr } = await db
    .from("lessons")
    .select("id, title, subject_id, group:groups(name)")
    .in("subject_id", [...subjectNameById.keys()])
    .gte("starts_at", ONLY_DAY ? `${ONLY_DAY}T00:00:00+05:00` : RANGE_FROM)
    .lt("starts_at", ONLY_DAY ? `${ONLY_DAY}T23:59:59+05:00` : RANGE_TO);
  if (lesErr) fail(`lessons: ${lesErr.message}`);
  console.log(`Уроков Programming+Robotics в диапазоне: ${lessons.length}`);

  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length === 0) { console.log("Уроков нет — выходим."); return; }

  // Стартовые административные этапы ("Старт", content_type=null) — без
  // содержимого, decideStageMedia на них заведомо вернёт "не нужно". Не
  // тратим на них вызов Gemini.
  const { data: allStages, error: stErr } = await db
    .from("lesson_stages")
    .select("id, lesson_id, position, stage_role, content_type, title, description, media_status")
    .in("lesson_id", lessonIds)
    .neq("stage_role", "start")
    .order("position", { ascending: true });
  if (stErr) fail(`lesson_stages: ${stErr.message}`);

  const todo = allStages.filter((s) => {
    // --force: перегенерировать даже уже готовые (см. комментарий у флага).
    if (s.media_status === "generated" && !FORCE) return false;
    if (s.media_status === "failed" && !RETRY_FAILED && !FORCE) return false;
    return true;
  });
  console.log(`Этапов (без "Старт"): ${allStages.length}. К обработке: ${todo.length}${RETRY_FAILED ? " (включая ранее failed)" : ""}.\n`);
  if (todo.length === 0) { console.log("Всё уже обработано — выходим."); return; }

  textModelName = await pickWorkingTextModel();
  if (!textModelName) fail("Ни одна текстовая модель Gemini не доступна.");

  let generated = 0, failed = 0, skipped = 0, imagesOk = 0, mermaidOk = 0, viaGemini = 0, viaPollinations = 0;

  for (let i = 0; i < todo.length; i++) {
    const stage = todo[i];
    const lesson = lessonById.get(stage.lesson_id);
    const subject = subjectNameById.get(lesson.subject_id) ?? "—";
    const groupName = lesson.group?.name ?? "—";
    const grade = gradeFromGroupName(groupName);
    const label = `${i + 1}/${todo.length}: ${subject} ${groupName} ${lesson.title} — ${stage.title}`;

    await db.from("lesson_stages").update({ media_status: "pending" }).eq("id", stage.id);

    const decision = await decideStageMedia(stage, { subject, grade, lesson_title: lesson.title });

    let imageOk = false, imageSource = null, mermaidOkThis = false, errorText = null;

    if (decision.need_image) {
      try {
        const { buffer, source } = await generateStageImage(decision.image_prompt);
        const url = await uploadStageImageToStorage(buffer, stage.id);
        await db.from("lesson_stages").update({ image_url: url, media_source: source }).eq("id", stage.id);
        imageOk = true;
        imageSource = source;
        imagesOk++;
        if (source === "gemini") viaGemini++; else viaPollinations++;
      } catch (e) {
        errorText = `image: ${(e.message ?? String(e)).slice(0, 500)}`;
      }
    }

    if (decision.need_mermaid && !errorText) {
      try {
        const code = await generateMermaidCode(decision.mermaid_prompt, grade);
        await db.from("lesson_stages").update({ mermaid_code: code }).eq("id", stage.id);
        mermaidOkThis = true;
        mermaidOk++;
      } catch (e) {
        errorText = `mermaid: ${(e.message ?? String(e)).slice(0, 500)}`;
      }
    }

    if (errorText) {
      await db.from("lesson_stages").update({ media_status: "failed", media_error: errorText }).eq("id", stage.id);
      failed++;
      console.log(`${label} — image:${decision.need_image ? "yes" : "no"} mermaid:${decision.need_mermaid ? "yes" : "no"} status:failed (${errorText.slice(0, 120)})`);
    } else {
      await db.from("lesson_stages").update({ media_status: "generated", media_error: null }).eq("id", stage.id);
      if (!decision.need_image && !decision.need_mermaid) skipped++;
      generated++;
      const imageLabel = imageOk ? `yes(${imageSource})` : "no";
      console.log(`${label} — image:${imageLabel} mermaid:${mermaidOkThis ? "yes" : "no"} status:generated`);
    }

    // Стоп-условие заказчика: >50% провалов после разумной выборки.
    const processed = i + 1;
    if (processed >= 10 && failed / processed > 0.5) {
      console.error(`\n!!! ОСТАНОВЛЕНО: провалов ${failed}/${processed} (>50%) — разберёмся перед продолжением.`);
      break;
    }
  }

  console.log(`\nГотово: обработано ${generated + failed}/${todo.length}. generated=${generated} (картинок=${imagesOk} [gemini=${viaGemini}, pollinations=${viaPollinations}], схем=${mermaidOk}, без медиа=${skipped}), failed=${failed}. Вызовов Gemini: ${geminiCallCount}.`);
  console.log(`Ориентировочная стоимость картинок через Gemini: ~$${(viaGemini * 0.039).toFixed(2)} (${viaGemini} × $0.039). Pollinations — бесплатно (${viaPollinations} шт).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
