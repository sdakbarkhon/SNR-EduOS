// Server-side only — generates slide illustrations.
// Tries Google Imagen first (requires a billing-enabled Gemini API key — plain
// Gemini Pro/Flash text access does NOT include Imagen, it's a separate Cloud
// billing product). Falls back to Pollinations.ai (free, no key) on any failure.
// Returns base64 PNG bytes, or null only if both providers fail.

const IMAGEN_MODEL = "imagen-3.0-generate-002";
const IMAGEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

async function tryImagen(styledPrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.warn("[ai-imagen] Imagen skipped: no GEMINI_API_KEY/GOOGLE_AI_API_KEY");
    return null;
  }

  console.log(`[ai-imagen] Imagen (${IMAGEN_MODEL}) request, prompt:`, styledPrompt.slice(0, 150));
  try {
    const res = await fetch(`${IMAGEN_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: styledPrompt }],
        parameters: { sampleCount: 1, aspectRatio: "16:9" },
      }),
    });
    console.log("[ai-imagen] Imagen response status:", res.status);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[ai-imagen] Imagen ${res.status} body:`, body.slice(0, 500));
      return null;
    }
    const data = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string }> };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded ?? null;
    if (!b64) {
      console.warn("[ai-imagen] Imagen returned 200 but no predictions[0].bytesBase64Encoded:", JSON.stringify(data).slice(0, 300));
    } else {
      console.log("[ai-imagen] Imagen success, base64 length:", b64.length);
    }
    return b64;
  } catch (e) {
    console.warn("[ai-imagen] Imagen threw:", (e as Error)?.message);
    return null;
  }
}

async function tryPollinations(styledPrompt: string): Promise<string | null> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=1024&height=576&nologo=true`;
  console.log("[ai-imagen] Pollinations fallback request:", url.slice(0, 150));
  try {
    const res = await fetch(url);
    console.log("[ai-imagen] Pollinations response status:", res.status);
    if (!res.ok) {
      console.warn(`[ai-imagen] Pollinations ${res.status}:`, (await res.text()).slice(0, 200));
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    console.log("[ai-imagen] Pollinations success, base64 length:", b64.length);
    return b64;
  } catch (e) {
    console.warn("[ai-imagen] Pollinations threw:", (e as Error)?.message);
    return null;
  }
}

export async function generateSlideImage(imagePrompt: string): Promise<string | null> {
  if (!imagePrompt.trim()) return null;

  // Academic illustration style for consistency across slides.
  const styledPrompt = `Academic educational illustration, clean flat style, soft colors, no text labels. ${imagePrompt.trim()}`;

  // Imagen via generativelanguage.googleapis.com's :predict path 404s for
  // every request — confirmed live (imagen-3.0-generate-002 "is not found
  // for API version v1beta, or is not supported for predict"), independent
  // of the API key. Attempting it first burned a full failed round trip per
  // slide (up to MAX_SLIDE_IMAGES of them), pushing generate-stages past its
  // 60s function timeout. Skip straight to the fallback that actually works
  // until this is repointed at a real Imagen-capable endpoint.
  if (process.env.AI_IMAGEN_ENABLED === "true") {
    const fromImagen = await tryImagen(styledPrompt);
    if (fromImagen) return fromImagen;
    console.log("[ai-imagen] Imagen unavailable, falling back to Pollinations");
  }
  return tryPollinations(styledPrompt);
}
