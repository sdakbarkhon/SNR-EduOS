import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-flash-lite-latest"];

function getTashkentDate(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

async function fetchGeminiFact(apiKey: string): Promise<string | null> {
  const MAX_LEN = 80;
  const prompt =
    `Один короткий интересный факт для школьников. СТРОГО: 1 предложение, максимум 80 символов на русском языке. Без вступления, без кавычек, без тире в начале. Только сам факт.\n` +
    `Примеры: "Сердце синего кита весит около 600 кг." / "Антарктида — самая большая пустыня мира."`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  let lastText: string | null = null;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
          body,
        });
        if (!res.ok) break;
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        if (!raw) continue;
        // Clean leading/trailing markdown, quotes, dashes
        const text = raw
          .replace(/^["""«»'\-—\*\s]+/, "")
          .replace(/["""«»'\*\s]+$/, "")
          .trim();
        if (text.length <= MAX_LEN) return text;
        lastText = text;
        console.warn(`[daily-fact] ${model} attempt ${attempt + 1}: ${text.length} chars, retrying`);
      } catch {
        break;
      }
    }
  }
  return lastText ? lastText.slice(0, 77) + "..." : null;
}

export async function GET() {
  const today = getTashkentDate();
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

  // Generate new fact
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const text = await fetchGeminiFact(apiKey);
  if (!text) {
    return NextResponse.json({ error: "AI временно недоступен" }, { status: 502 });
  }

  // Persist to DB (ignore conflict — another request may have inserted first)
  await anyDb.from("daily_facts").upsert({ fact_date: today, fact_text: text }, { onConflict: "fact_date" });

  return NextResponse.json({ text });
}
