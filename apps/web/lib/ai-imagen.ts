// Server-side only — generates slide illustrations via Google Imagen.
// Returns base64 PNG bytes, or null on any failure (caller renders slide w/o image).
//
// NOTE: imagen-3.0-generate-002 requires a billing-enabled Gemini API key. If the
// key lacks access the predict endpoint returns 4xx — we swallow it and the slide
// simply has no image. Generation never blocks stage creation.

const IMAGEN_MODEL = "imagen-3.0-generate-002";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

export async function generateSlideImage(imagePrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || !imagePrompt.trim()) return null;

  // Academic illustration style for consistency across slides.
  const styledPrompt = `Academic educational illustration, clean flat style, soft colors, no text labels. ${imagePrompt.trim()}`;

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: styledPrompt }],
        parameters: { sampleCount: 1, aspectRatio: "16:9" },
      }),
    });
    if (!res.ok) {
      console.warn(`[ai-imagen] predict ${res.status}:`, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string }> };
    return data.predictions?.[0]?.bytesBase64Encoded ?? null;
  } catch (e) {
    console.warn("[ai-imagen] error:", (e as Error)?.message);
    return null;
  }
}
