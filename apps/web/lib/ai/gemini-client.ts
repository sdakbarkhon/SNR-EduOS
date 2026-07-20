// Server-side only — API key never reaches the browser.
// Единый Gemini-клиент для всех AI-фич платформы (замена apps/web/lib/ai-claude.ts,
// удалён в этом же промте). Проверенный на практике SDK-паттерн (systemInstruction,
// generateContent, generateContentStream, responseMimeType/responseSchema) —
// портирован из apps/web/generate-weekend.mjs, где он уже отработал вживую на
// реальном трафике этого проекта.
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  type Content,
  type ResponseSchema,
  type Tool,
} from "@google/generative-ai";
import { resolveModel, type AiModelTier } from "./config";
import { createAdminClient } from "@/lib/supabase/admin";

// Пачка 3, Задача 2 — глобальный дневной счётчик вызовов Gemini (X/250,
// миграция 136). withRetry() — единственная точка, через которую проходят
// ВСЕ реальные HTTP-вызовы к Gemini (generateText/generateContent/
// generateJSON/chat), поэтому инкремент здесь покрывает всё приложение
// сразу, без правок в каждом вызывающем месте. streamChat() эту функцию не
// использует (не подключён ни к одному роуту, см. комментарий ниже) —
// соответственно не считается, что корректно: посчитан должен быть только
// реальный расход квоты.
// Fire-and-forget: сбой счётчика не должен ронять саму AI-фичу.
// as any: increment_ai_usage() из миграции 136 ещё не в сгенерённых
// database.types.ts (тот же паттерн, что claim_demo_slot и др. в Пачке 2).
function bumpAiUsage(): void {
  (createAdminClient().rpc as any)("increment_ai_usage")
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error("[gemini-client] increment_ai_usage failed:", error.message);
    })
    .catch((e: unknown) => {
      console.error("[gemini-client] increment_ai_usage threw:", (e as Error)?.message);
    });
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiConfigError("GEMINI_API_KEY missing on server");
  }
  return new GoogleGenerativeAI(apiKey);
}

class AiConfigError extends Error {}

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
export type AiResult = { text: string; error: string | null };
export type AiOptions = {
  model?: AiModelTier;
  temperature?: number;
  maxTokens?: number;
  useSearch?: boolean;
};

function searchTool(useSearch: boolean | undefined): Tool[] | undefined {
  return useSearch ? [{ googleSearchRetrieval: {} }] : undefined;
}

// assistant -> "model": Gemini's Content.role only accepts "user"|"model",
// the app's own convention elsewhere already uses "assistant" (matches the
// old Anthropic messages[] shape) — normalized here once, not at every call site.
function toGeminiHistory(messages: ChatMessage[]): Content[] {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // First turn must be role "user" — same trimming rule ai-claude.ts had
  // for Anthropic (a truncated history window can start mid-conversation).
  while (contents.length > 0 && contents[0]?.role !== "user") contents.shift();
  return contents;
}

// Изначально ловил 429 "limit: 0" (структурное отсутствие Pro-доступа на
// free tier) и триггерил немедленный downgrade tier "pro"→"flash" внутри
// той же попытки. Ночной прогон, ЧАСТЬ 1: gemini-2.5-pro теперь возвращает
// 404 "no longer available to new users" — другой класс ошибки — и, что
// важнее, resolveModel() в ./config.ts больше НИКОГДА не резолвит tier
// "pro" в реальную Pro-модель (всегда Flash), поэтому сам API-запрос ниже
// уже не может попасть на Pro и словить ни 429, ни 404 от него. Эта ветка
// (и isZeroQuota) оставлены как безопасный no-op на случай, если Pro
// когда-нибудь снова включат в resolveModel() — тогда защита от zero-quota
// сразу заработает снова без правок здесь.
function isZeroQuota(message: string): boolean {
  return /limit:\s*0\b/i.test(message);
}

/** Общий retry/ошибка-в-текст враппер — те же пользовательские сообщения и
 *  backoff-стратегия (1s/2s/4s на 429 и 5xx), что были в ai-claude.ts, чтобы
 *  UX не поменялся при смене провайдера. run(tier) получает ТЕКУЩИЙ tier —
 *  может отличаться от запрошенного, если сработал zero-quota downgrade. */
async function withRetry(
  label: string,
  requestedTier: AiModelTier | undefined,
  run: (tier: AiModelTier | undefined) => Promise<string>,
): Promise<AiResult> {
  let apiKeyPresent = true;
  try {
    getClient();
  } catch {
    apiKeyPresent = false;
  }
  console.log(`[gemini-client] ${label} | key present:`, apiKeyPresent, "| tier:", requestedTier ?? "flash");
  if (!apiKeyPresent) return { text: "", error: "API key not configured" };

  let tier = requestedTier;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const text = await run(tier);
      console.log(`[gemini-client] ${label} done, response length:`, text.length);
      bumpAiUsage();
      return { text, error: null };
    } catch (e: unknown) {
      if (e instanceof GoogleGenerativeAIFetchError) {
        const status = e.status ?? 0;
        if (status === 429) {
          if (tier === "pro" && isZeroQuota(e.message)) {
            console.warn(`[gemini-client] ${label} gemini-2.5-pro has zero quota on this API key — downgrading to Flash and retrying immediately`);
            tier = "flash";
            continue; // no backoff delay — this isn't a transient condition
          }
          if (attempt < MAX_RETRIES - 1) {
            const delay = BASE_DELAY_MS * 2 ** attempt;
            console.warn(`[gemini-client] ${label} 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await sleep(delay);
            continue;
          }
          return { text: "", error: "Сейчас много запросов, попробуй через минуту" };
        }
        if (status === 401 || status === 403) {
          console.error(`[gemini-client] ${label} auth error:`, e.message);
          return { text: "", error: "AI временно недоступен (ошибка авторизации)" };
        }
        if (status >= 500) {
          if (attempt < MAX_RETRIES - 1) {
            const delay = BASE_DELAY_MS * 2 ** attempt;
            console.warn(`[gemini-client] ${label} server/overload error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await sleep(delay);
            continue;
          }
          return { text: "", error: "AI временно перегружен, попробуй чуть позже" };
        }
      }
      const err = e as Error;
      console.error(`[gemini-client] ${label} SDK error:`, err?.message);
      return { text: "", error: err?.message || "AI request failed" };
    }
  }
  return { text: "", error: "AI request failed after retries" };
}

/** Простой одноразовый текстовый запрос (без истории). Модель по умолчанию —
 *  Flash. Используется для коротких генераций: факт дня, совет по учёбе,
 *  совет по оценкам. */
export async function generateText(prompt: string, options?: AiOptions): Promise<AiResult> {
  return withRetry("generateText", options?.model, async (tier) => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: resolveModel(tier),
      generationConfig: {
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
      },
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(searchTool(options?.useSearch) ? { tools: searchTool(options?.useSearch) } : {}),
    });
    return result.response.text();
  });
}

/** Длинный контент (теория урока, слайды, планы) — по умолчанию Pro, но
 *  вызывающий код всё равно может явно передать model:"flash". Автоматически
 *  откатывается на Flash, если у ключа нет Pro-квоты (см. withRetry). */
export async function generateContent(prompt: string, options?: AiOptions): Promise<AiResult> {
  return generateText(prompt, { model: "pro", ...options });
}

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Structured output через generationConfig.responseSchema (когда схема
 *  передана) — убирает markdown-обёртку и chain-of-thought из ответа,
 *  экономит output-токены (см. resheniya_2.md, ЧАСТЬ 5). Без схемы —
 *  просто responseMimeType:"application/json" (тот же режим, что уже
 *  доказал себя в generate-weekend.mjs), вызывающий код сам парсит текст —
 *  это осознанный выбор для промптов со слишком полиморфной структурой
 *  для безопасного описания schema (см. resheniya_2.md). */
export async function generateJSON<T>(
  prompt: string,
  schema: ResponseSchema | null,
  options?: AiOptions,
): Promise<{ data: T | null; error: string | null }> {
  const { text, error } = await withRetry("generateJSON", options?.model, async (tier) => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: resolveModel(tier),
      generationConfig: {
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {}),
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
      },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
  if (error) return { data: null, error };
  try {
    return { data: JSON.parse(stripFences(text)) as T, error: null };
  } catch (e: unknown) {
    console.error("[gemini-client] generateJSON parse error:", text.slice(0, 300), (e as Error)?.message);
    return { data: null, error: "Generated JSON parse error" };
  }
}

/** Retry-safe чат с историей, БЕЗ стриминга — прямая замена
 *  callClaude(systemPrompt, messages, options) из ai-claude.ts. Используется
 *  двумя реальными чат-фичами платформы (лёгкий чат внутри урока и общий
 *  AI-ассистент), у которых UI сейчас ждёт единый ответ, а не поток токенов —
 *  сохраняет тот же контракт, чтобы миграция не меняла поведение фронтенда. */
export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  options?: AiOptions,
): Promise<AiResult> {
  return withRetry("chat", options?.model, async (tier) => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: resolveModel(tier),
      systemInstruction: systemPrompt,
      generationConfig: {
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
      },
    });
    const contents = toGeminiHistory(messages);
    if (contents.length === 0) throw new Error("No message to send");
    const result = await model.generateContent({
      contents,
      ...(searchTool(options?.useSearch) ? { tools: searchTool(options?.useSearch) } : {}),
    });
    return result.response.text();
  });
}

/** Настоящий streaming-примитив (generateContentStream) — пока НЕ подключён
 *  ни к одному роуту: оба текущих чата (лесson-чат и общий ассистент) ждут
 *  единый JSON-ответ на фронтенде, переход на потоковую выдачу токенов
 *  потребовал бы отдельной правки UI (SSE/ReadableStream на клиенте), что
 *  не запрошено в этом промте — задел на будущее, соответствует пункту ТЗ
 *  "streamChat(messages, options): для чата со стримингом". */
export async function streamChat(
  messages: ChatMessage[],
  options?: AiOptions & { systemPrompt?: string },
): Promise<{ stream: AsyncGenerator<string>; text: Promise<string> }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: resolveModel(options?.model),
    ...(options?.systemPrompt ? { systemInstruction: options.systemPrompt } : {}),
    generationConfig: {
      ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      ...(options?.temperature != null ? { temperature: options.temperature } : {}),
    },
  });
  const contents = toGeminiHistory(messages);
  const result = await model.generateContentStream({
    contents,
    ...(searchTool(options?.useSearch) ? { tools: searchTool(options?.useSearch) } : {}),
  });

  async function* textChunks() {
    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }

  return { stream: textChunks(), text: result.response.then((r) => r.text()) };
}
