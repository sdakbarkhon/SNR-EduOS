import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText } from "@/lib/ai/gemini-client";

function getTashkentDate(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

// Промт 6.2.1: реальная причина 502 — не сам факт отказа AI-вызова (тот уже
// был обработан как контролируемый JSON-ответ), а то, что generateText()
// внутри себя ретраит с exponential backoff (1s/2s/4s) на 429/5xx, а
// fetchAiFact() СВЕРХУ ретраит generateText() ещё до 3 раз (если факт длиннее
// 80 символов) — в худшем случае это легко уходит за 10-секундный лимit
// serverless-функции на Vercel Hobby/Free, и платформа убивает функцию ДО
// того, как код успевает вернуть свой собственный контролируемый JSON —
// наружу уходит сырой инфраструктурный "502 Bad Gateway", а не
// {error: ...}. Фикс: жёсткий таймаут-гвард вокруг fetchAiFact() (well
// under 10s) + статический fallback вместо любого отказа/исключения —
// эндпоинт больше никогда не возвращает не-200.
const FETCH_TIMEOUT_MS = 6000;

const FALLBACK_FACTS: string[] = [
  "Мёд не портится — археологи находили съедобный мёд возрастом 3000 лет.",
  "Осьминоги имеют три сердца и голубую кровь.",
  "Свет от Солнца долетает до Земли примерно за 8 минут.",
  "Человеческий мозг генерирует около 20 ватт энергии — хватит на лампочку.",
  "Антарктида — самая большая пустыня в мире по площади.",
  "Сердце синего кита весит около 600 кг — размером с малолитражку.",
  "У жирафа и человека одинаковое число шейных позвонков — по семь.",
  "Молния горячее поверхности Солнца примерно в пять раз.",
  "Бумагу нельзя сложить пополам больше 7-8 раз подряд.",
  "Улитки могут спать до трёх лет подряд в неблагоприятных условиях.",
  "Эйфелева башня летом становится выше на несколько сантиметров из-за жары.",
  "У акул было больше времени на эволюцию, чем у деревьев.",
  "Один день на Венере длиннее, чем один год на Венере.",
  "Отпечатки языка у собак так же уникальны, как отпечатки пальцев у людей.",
  "Банан — это ягода, а клубника — нет, с ботанической точки зрения.",
  "Первый компьютерный вирус появился ещё в 1980-х годах.",
  "В теле человека столько же генов, сколько у обычного риса.",
  "Кровь у осьминога голубая из-за меди в её составе, а не железа.",
  "Самый короткий международный рейс в мире длится меньше двух минут.",
  "Вода может одновременно кипеть и замерзать в определённых условиях (тройная точка).",
];

function fallbackFact(dateStr: string): string {
  // Детерминированно по дате (не Math.random) — один и тот же fallback
  // весь день, меняется на следующий, сохраняя смысл "факта дня".
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  return FALLBACK_FACTS[hash % FALLBACK_FACTS.length]!;
}

// Раньше факт требовался ≤80 символов, а если модель возвращала длиннее —
// код резал его на 77 символов ПОСРЕДИ СЛОВА ("...си") и/или ретраил до 3 раз
// (что уводило за 10-секундный лимит Vercel). Плюс кэш в daily_facts не
// сохранялся (см. GET ниже — school_id), поэтому каждый заход генерил НОВЫЙ
// факт и обрывал его по-разному. Теперь: один вызов, берём первое законченное
// предложение, лимит 140 символов, обрезка строго ПО ГРАНИЦЕ СЛОВА + «…».
async function fetchAiFact(): Promise<string | null> {
  const MAX_LEN = 140;
  const prompt =
    `Один короткий интересный факт для школьников. СТРОГО: одно законченное предложение на русском языке, до 140 символов. Без вступления, без кавычек, без тире в начале. Только сам факт.\n` +
    `Примеры: "Сердце синего кита весит около 600 кг." / "Антарктида — самая большая пустыня мира."`;
  const { text: raw, error } = await generateText(prompt, { maxTokens: 200 });
  if (error || !raw.trim()) return null;
  let text = raw
    .trim()
    .replace(/^["“”«»'\-—\*\s]+/, "")
    .replace(/["“”«»'\*\s]+$/, "")
    .trim();
  // Только первое предложение (модель иногда добавляет второе).
  const firstSentence = text.match(/^[^.!?]*[.!?]/);
  if (firstSentence) text = firstSentence[0].trim();
  if (text.length > MAX_LEN) {
    const cut = text.slice(0, MAX_LEN);
    const lastSpace = cut.lastIndexOf(" ");
    text = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }
  return text || null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function GET() {
  const today = getTashkentDate();

  try {
    const db = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDb = db as any;

    // Check DB cache first (daily_facts added in migration 52 — cast until types are regenerated)
    const { data: cached } = (await anyDb
      .from("daily_facts")
      .select("fact_text")
      .eq("fact_date", today)
      .maybeSingle()) as { data: { fact_text: string } | null };

    if (cached?.fact_text) {
      return NextResponse.json({ text: cached.fact_text });
    }

    // Generate new fact — hard timeout so a slow/retrying Gemini call can
    // never push this route past Vercel's serverless function limit.
    const text = await withTimeout(fetchAiFact(), FETCH_TIMEOUT_MS);
    if (!text) {
      console.error("[daily-fact] AI fact generation failed or timed out — serving static fallback");
      return NextResponse.json({ text: fallbackFact(today) });
    }

    // Persist to DB (ignore conflict — another request may have inserted first).
    // КРИТИЧНО: миграция 71 добавила daily_facts.school_id NOT NULL DEFAULT
    // current_school_id(). Под admin/service-role клиентом auth.uid() нет →
    // дефолт молча резолвился в NULL → upsert падал, а его .error НЕ
    // проверялся (реф 5222b73) → факт НИКОГДА не кэшировался → каждый заход
    // генерил НОВЫЙ факт и обрывал его по-разному (root cause «На Марсе
    // закаты си/юлу»). Фикс: резолвим school_id из данных (единственная школа)
    // и проверяем .error.
    const { data: school } = (await anyDb.from("schools").select("id").limit(1).maybeSingle()) as {
      data: { id: string } | null;
    };
    if (school?.id) {
      const { error: upsertErr } = await anyDb
        .from("daily_facts")
        .upsert({ fact_date: today, fact_text: text, school_id: school.id }, { onConflict: "fact_date" });
      if (upsertErr) console.error("[daily-fact] cache upsert failed:", upsertErr.message);
    } else {
      console.error("[daily-fact] no school row found — fact not cached");
    }

    return NextResponse.json({ text });
  } catch (e) {
    console.error("[daily-fact] unexpected error — serving static fallback:", (e as Error)?.message ?? e);
    return NextResponse.json({ text: fallbackFact(today) });
  }
}
