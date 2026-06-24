// Server-side only — API key never reaches the browser.
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.0-flash";

export async function callGemini(
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; responseMimeType?: string },
): Promise<{ text: string; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  console.log("[ai-gemini] model:", MODEL, "| key present:", !!apiKey, "| key length:", apiKey?.length ?? 0);

  if (!apiKey) {
    console.error("[ai-gemini] GEMINI_API_KEY missing on server");
    return { text: "", error: "API key not configured" };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    if (messages.length === 0) {
      // No chat history (e.g. generate-stages): send the whole prompt as generateContent
      const model = genAI.getGenerativeModel({
        model: MODEL,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        },
      });
      const result = await model.generateContent(systemInstruction);
      const text = result.response.text();
      console.log("[ai-gemini] generateContent done, response length:", text.length);
      return { text, error: null };
    }

    // Chat with history: set system instruction at model level
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      },
    });

    // history = everything except the last message
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return { text: "", error: "No message to send" };
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();
    console.log("[ai-gemini] chat done, response length:", text.length);
    return { text, error: null };
  } catch (e: unknown) {
    const err = e as Error & { status?: number; statusText?: string; errorDetails?: unknown };
    console.error("[ai-gemini] SDK error:", {
      message: err?.message,
      status: err?.status,
      statusText: err?.statusText,
      errorDetails: JSON.stringify(err?.errorDetails ?? "").slice(0, 200),
    });
    if (err?.message?.includes("429")) {
      return { text: "", error: "Сейчас много запросов, попробуй через минуту" };
    }
    return { text: "", error: err?.message || "AI request failed" };
  }
}
