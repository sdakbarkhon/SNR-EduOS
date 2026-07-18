// Server-side only — API key never reaches the browser.
// Пачка 5.1 — вычисление эмбеддингов для RAG-ретривала EduOS Assistant.
// Отдельный клиент от apps/web/lib/ai/gemini-client.ts (тот заточен под
// текстовую генерацию — generateText/chat/generateJSON — embedContent
// концептуально другой вызов с другим форматом ответа, смешивать не стал).
//
// text-embedding-004 (изначальный выбор) не существует на v1beta — живой
// 404 при backfill ("models/text-embedding-004 is not found for API
// version v1beta, or is not supported for embedContent"), подтверждено
// прямым запросом к ListModels: этой модели нет в списке вовсе, только
// gemini-embedding-001 / gemini-embedding-2-preview / gemini-embedding-2
// поддерживают embedContent. gemini-embedding-001 нативно отдаёт 3072-мерный
// вектор — 768 достигается ТОЛЬКО через явный параметр outputDimensionality
// (MRL-усечение), подтверждено живым тестом (без параметра — 3072, с
// outputDimensionality:768 — ровно 768, совместимо со схемой vector(768)
// миграции 139 без каких-либо изменений).
//
// @google/generative-ai (текущая версия, см. node_modules .d.ts)
// EmbedContentRequest НЕ имеет поля outputDimensionality в типах вообще —
// SDK его просто не пробрасывает. Поэтому здесь, как и в
// apps/web/lib/ai-imagen.ts (тот же приём для Imagen, тоже не покрыт
// SDK), — прямой fetch к REST API вместо SDK-метода embedContent().

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const EMBED_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing on server");
  return apiKey;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BACKOFF_429_MS = [3000, 10000, 30000];

/** Вычисляет 768-мерный вектор эмбеддинга для текста через Gemini
 *  gemini-embedding-001 (outputDimensionality:768, MRL-усечение с
 *  нативных 3072). Ретраи: 429 → экспоненциальный backoff 3с/10с/30с
 *  (макс. 3 попытки), прочие ошибки → 1 ретрай, затем throw. */
export async function computeEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();

  let otherErrorRetried = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${EMBED_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`embedContent ${res.status}: ${body.slice(0, 500)}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }

      const data = (await res.json()) as { embedding?: { values?: number[] } };
      const values = data.embedding?.values;
      if (!values) throw new Error(`embedContent response missing embedding.values: ${JSON.stringify(data).slice(0, 300)}`);
      if (values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Unexpected embedding dimensionality: ${values.length} (expected ${EMBEDDING_DIMENSIONS})`);
      }
      return values;
    } catch (e) {
      const is429 = (e as Error & { status?: number })?.status === 429;
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
