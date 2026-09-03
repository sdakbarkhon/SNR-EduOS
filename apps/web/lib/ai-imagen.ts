// Картинки СЛАЙДОВ. Основной рисовальщик — gemini-2.5-flash-image (тот же, что
// у картинок этапов, и та же функция), запасной — Pollinations.ai (бесплатно,
// без ключа). Возвращает base64 PNG или null, если не смог ни один.
//
// 04.09.2026 — ОТСЮДА УБРАН IMAGEN. Здесь была первая попытка через
// imagen-3.0-generate-002 по адресу :predict, закрытая гейтом
// AI_IMAGEN_ENABLED. Гейт не был включён никогда, а сам Imagen на ключе
// отсутствует: перечень моделей отдаёт 55 штук, семейства imagen-* среди них
// ноль. Мёртвая проверка вводила в заблуждение — «а вдруг включим» было
// невозможно в принципе.

import { tryGeminiImage } from "@/lib/ai/stage-media-prompts";

async function tryPollinations(styledPrompt: string): Promise<string | null> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=1024&height=576&nologo=true`;
  console.log("[ai-imagen] Pollinations fallback request:", url.slice(0, 150));
  try {
    const res = await fetch(url);
    console.log("[ai-imagen] Pollinations response status:", res.status);
    if (!res.ok) {
      console.warn(`[ai-imagen] Pollinations ${res.status}:`, (await res.text()).slice(0, 200));
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    console.log("[ai-imagen] Pollinations success, base64 length:", b64.length);
    return b64;
  } catch (e) {
    console.warn("[ai-imagen] Pollinations threw:", (e as Error)?.message);
    return null;
  }
}

/** Сколько знаков текста слайда кладём в промт картинки. */
const ТЕКСТА_В_ПРОМТ = 700;

/**
 * КАРТИНКА СЛАЙДА. 04.09.2026 — ДВЕ ПРАВКИ.
 *
 * ПЕРВАЯ: РИСУЕТ GEMINI, А НЕ POLLINATIONS. Раньше здесь стоял гейт
 * `AI_IMAGEN_ENABLED === "true"`, а переменной такой нет ни в окружении, ни в
 * репозитории — то есть Imagen не пробовался НИ РАЗУ, и сто процентов
 * картинок слайдов рисовал запасной путь. Гейт убран как мёртвый: Imagen на
 * ключе нет вовсе — в перечне моделей семейства imagen-* ноль штук, зато есть
 * шесть картиночных Gemini. Рисуем тем же gemini-2.5-flash-image, которым уже
 * рисуются картинки этапов, и той же функцией — второй копии вызова нет.
 *
 * Pollinations остаётся запасным: он и был им у картинок этапов, работает и
 * стоит ноль. Разница видна по весу файла — у Gemini в среднем 907 КБ против
 * 24 КБ у запасного.
 *
 * ВТОРАЯ: В ПРОМТ ИДЁТ ТЕКСТ СЛАЙДА. Раньше уходил только image_prompt,
 * который модель сочинила заранее, — картинка не видела содержимого слайда и
 * не могла быть про него. Теперь рядом кладётся сам текст, обрезанный до
 * ${ТЕКСТА_В_ПРОМТ} знаков: этого хватает, чтобы понять, о чём слайд, и промт
 * не раздувается — картиночная модель длинные простыни всё равно смазывает.
 */
export async function generateSlideImage(
  imagePrompt: string,
  slide?: { title?: string; content?: string },
): Promise<string | null> {
  if (!imagePrompt.trim()) return null;

  const текст = (slide?.content ?? "").replace(/\s+/g, " ").trim().slice(0, ТЕКСТА_В_ПРОМТ);
  const контекст = [
    slide?.title?.trim() ? `Slide title: ${slide.title.trim()}` : "",
    текст ? `Slide text: ${текст}` : "",
  ].filter(Boolean).join("\n");

  // Academic illustration style for consistency across slides.
  const styledPrompt = [
    `Academic educational illustration, clean flat style, soft colors, no text labels. ${imagePrompt.trim()}`,
    контекст ? `Draw exactly what this slide is about.\n${контекст}` : "",
  ].filter(Boolean).join("\n\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const buffer = await tryGeminiImage(styledPrompt, apiKey);
      return buffer.toString("base64");
    } catch (e) {
      console.warn("[ai-imagen] gemini не нарисовал, уходим на Pollinations:", (e as Error)?.message);
    }
  } else {
    console.warn("[ai-imagen] нет ключа Gemini — сразу на Pollinations");
  }
  return tryPollinations(styledPrompt);
}
