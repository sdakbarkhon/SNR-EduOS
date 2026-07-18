// Server-side only — API key never reaches the browser.
// Пачка 5.1 — вычисление эмбеддингов для RAG-ретривала EduOS Assistant.
// Отдельный клиент от apps/web/lib/ai/gemini-client.ts (тот заточен под
// текстовую генерацию — generateText/chat/generateJSON — embedContent
// концептуально другой вызов с другим форматом ответа, смешивать не стал).

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing on server");
  return new GoogleGenerativeAI(apiKey);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BACKOFF_429_MS = [3000, 10000, 30000];

/** Вычисляет 768-мерный вектор эмбеддинга для текста через Gemini
 *  text-embedding-004. Ретраи: 429 → экспоненциальный backoff 3с/10с/30с
 *  (макс. 3 попытки), прочие ошибки → 1 ретрай, затем throw. */
export async function computeEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  let otherErrorRetried = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await model.embedContent(text);
      const values = result.embedding.values;
      if (values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Unexpected embedding dimensionality: ${values.length} (expected ${EMBEDDING_DIMENSIONS})`);
      }
      return values;
    } catch (e) {
      const is429 = e instanceof GoogleGenerativeAIFetchError && e.status === 429;
      if (is429 && attempt < BACKOFF_429_MS.length) {
        const delay = BACKOFF_429_MS[attempt]!; // guarded by attempt < BACKOFF_429_MS.length above
        console.warn(`[embeddings] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${BACKOFF_429_MS.length})`);
        await sleep(delay);
        continue;
      }
      if (!is429 && !otherErrorRetried) {
        otherErrorRetried = true;
        console.warn(`[embeddings] error "${(e as Error)?.message}", 1 retry`);
        continue;
      }
      throw e;
    }
  }
}
