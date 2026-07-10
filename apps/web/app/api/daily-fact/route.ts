import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai-claude";

function getTashkentDate(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

async function fetchAiFact(): Promise<string | null> {
  const MAX_LEN = 80;
  const prompt =
    `Один короткий интересный факт для школьников. СТРОГО: 1 предложение, максимум 80 символов на русском языке. Без вступления, без кавычек, без тире в начале. Только сам факт.\n` +
    `Примеры: "Сердце синего кита весит около 600 кг." / "Антарктида — самая большая пустыня мира."`;
  let lastText: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { text: raw, error } = await callClaude(prompt, [], { maxTokens: 128 });
    if (error || !raw.trim()) break;
    // Clean leading/trailing markdown, quotes, dashes
    const text = raw
      .trim()
      .replace(/^["""«»'\-—\*\s]+/, "")
      .replace(/["""«»'\*\s]+$/, "")
      .trim();
    if (text.length <= MAX_LEN) return text;
    lastText = text;
    console.warn(`[daily-fact] attempt ${attempt + 1}: ${text.length} chars, retrying`);
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
  const text = await fetchAiFact();
  if (!text) {
    return NextResponse.json({ error: "AI временно недоступен" }, { status: 502 });
  }

  // Persist to DB (ignore conflict — another request may have inserted first)
  await anyDb.from("daily_facts").upsert({ fact_date: today, fact_text: text }, { onConflict: "fact_date" });

  return NextResponse.json({ text });
}
