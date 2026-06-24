const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function callGemini(
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; responseMimeType?: string },
): Promise<{ text: string; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { text: "", error: "GEMINI_API_KEY not configured on server" };
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      ...(options?.responseMimeType
        ? { response_mime_type: options.responseMimeType }
        : {}),
    },
  };

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      return { text: "", error: "Сейчас много запросов, попробуй через минуту" };
    }
    if (!res.ok) {
      return { text: "", error: "Ошибка сервиса ИИ. Попробуй ещё раз." };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text, error: null };
  } catch {
    return { text: "", error: "Ошибка соединения. Попробуй ещё раз." };
  }
}
