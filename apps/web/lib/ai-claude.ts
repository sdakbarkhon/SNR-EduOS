// Server-side only — API key never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callClaude(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; useSearch?: boolean; maxTokens?: number },
): Promise<{ text: string; error: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("[ai-claude] model:", MODEL, "| key present:", !!apiKey, "| search:", !!options?.useSearch);

  if (!apiKey) {
    console.error("[ai-claude] ANTHROPIC_API_KEY missing on server");
    return { text: "", error: "API key not configured" };
  }

  const client = new Anthropic({ apiKey });

  // messages=[] (e.g. generate-stages/generate-homework, which send the
  // whole prompt as a single instruction with no chat history) maps to a
  // single user turn carrying the full prompt — Claude has no equivalent
  // of a system-prompt-only completion call.
  const anthropicMessages: Anthropic.MessageParam[] =
    messages.length === 0
      ? [{ role: "user", content: systemPrompt }]
      : messages.map((m) => ({ role: m.role, content: m.content }));

  // First message must be role "user" — trim any leading assistant turns
  // (can happen if a truncated chat-history window starts mid-conversation).
  while (anthropicMessages.length > 0 && anthropicMessages[0]?.role !== "user") {
    anthropicMessages.shift();
  }
  if (anthropicMessages.length === 0) return { text: "", error: "No message to send" };

  const effectiveSystem = messages.length === 0 ? undefined : systemPrompt;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: options?.maxTokens ?? 8192,
        ...(effectiveSystem ? { system: effectiveSystem } : {}),
        messages: anthropicMessages,
        // Grounding via live web search, when requested by the caller.
        ...(options?.useSearch ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const }] } : {}),
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      console.log("[ai-claude] done, response length:", text.length);
      return { text, error: null };
    } catch (e: unknown) {
      if (e instanceof Anthropic.RateLimitError) {
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * 2 ** attempt;
          console.warn(`[ai-claude] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          continue;
        }
        return { text: "", error: "Сейчас много запросов, попробуй через минуту" };
      }
      if (e instanceof Anthropic.AuthenticationError) {
        console.error("[ai-claude] invalid API key:", e.message);
        return { text: "", error: "AI временно недоступен (ошибка авторизации)" };
      }
      // 5xx incl. 529 overloaded — anthropic-ai/sdk maps all >=500 to InternalServerError.
      if (e instanceof Anthropic.InternalServerError) {
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * 2 ** attempt;
          console.warn(`[ai-claude] server/overload error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          continue;
        }
        return { text: "", error: "AI временно перегружен, попробуй чуть позже" };
      }
      const err = e as Error;
      console.error("[ai-claude] SDK error:", err?.message);
      return { text: "", error: err?.message || "AI request failed" };
    }
  }
  return { text: "", error: "AI request failed after retries" };
}
