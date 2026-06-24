// Gemini API — server-side only. Key never reaches the browser.
const MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function callGemini(
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; responseMimeType?: string },
): Promise<{ text: string; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;

  console.log("[ai-gemini] key present:", !!apiKey, "key length:", apiKey?.length ?? 0);

  if (!apiKey) {
    return { text: "", error: "GEMINI_API_KEY not configured on server" };
  }

  // Gemini REST API requires at least one content item.
  // When there are no chat messages (e.g. generate-stages) we send the
  // system instruction as a user turn so the array is never empty.
  const contents =
    messages.length > 0
      ? messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))
      : [{ role: "user", parts: [{ text: systemInstruction }] }];

  // camelCase field names as required by the Gemini REST API
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      ...(options?.responseMimeType
        ? { responseMimeType: options.responseMimeType }
        : {}),
    },
  };

  // Only add systemInstruction when we also have real chat messages
  // (when messages is empty we already embedded the instruction as a user turn above)
  if (messages.length > 0 && systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("[ai-gemini] response status:", res.status);

    if (!res.ok) {
      let errBody = "(could not read body)";
      try {
        errBody = await res.text();
      } catch { /* noop */ }
      console.error("[ai-gemini] non-OK response:", res.status, errBody.slice(0, 500));

      if (res.status === 429) {
        return { text: "", error: "Сейчас много запросов, попробуй через минуту" };
      }
      return { text: "", error: `Ошибка Gemini API ${res.status}: ${errBody.slice(0, 120)}` };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    console.log("[ai-gemini] candidates count:", data?.candidates?.length ?? 0);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
      console.error("[ai-gemini] empty text in response:", JSON.stringify(data).slice(0, 300));
    }
    return { text, error: text ? null : "Пустой ответ от ИИ. Попробуй ещё раз." };
  } catch (e: unknown) {
    const err = e as Error;
    console.error("[ai-gemini] fetch error:", err?.message, err?.stack);
    return { text: "", error: "Ошибка соединения. Попробуй ещё раз." };
  }
}
