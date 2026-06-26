import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-flash-lite-latest"];

function getTashkentDate(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

async function fetchGeminiFact(apiKey: string): Promise<string | null> {
  const today = getTashkentDate();
  const body = JSON.stringify({
    contents: [
      { role: "user", parts: [{ text: `Дай один интересный факт из науки, истории или технологий — 1-2 предложения, живо и увлекательно. Только факт, без вводных слов. Дата: ${today}.` }] },
    ],
  });
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
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
