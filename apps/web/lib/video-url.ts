// Пачка 4 — парсинг ссылок на видео (YouTube/RuTube) для материалов урока.
// Поддерживаемые форматы:
//   YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
//   RuTube:  rutube.ru/video/ID/, rutube.ru/play/embed/ID
// Параметры вида ?t=15s, &list=... игнорируются — извлекаем только ID.

export type VideoPlatform = "youtube" | "rutube";
export type ParsedVideoUrl = { platform: VideoPlatform; id: string; embedUrl: string };

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{6,}$/;
const RUTUBE_ID_RE = /^[a-zA-Z0-9]{6,}$/;

export function parseVideoUrl(raw: string): ParsedVideoUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id && YOUTUBE_ID_RE.test(id)) return { platform: "youtube", id, embedUrl: toEmbedUrl("youtube", id) };
      return null;
    }
    const embedMatch = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
    const embedId = embedMatch?.[1];
    if (embedId) return { platform: "youtube", id: embedId, embedUrl: toEmbedUrl("youtube", embedId) };
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
    if (id && YOUTUBE_ID_RE.test(id)) return { platform: "youtube", id, embedUrl: toEmbedUrl("youtube", id) };
    return null;
  }

  if (host === "rutube.ru") {
    const embedMatch = url.pathname.match(/^\/play\/embed\/([a-zA-Z0-9]+)/);
    const embedId = embedMatch?.[1];
    if (embedId) return { platform: "rutube", id: embedId, embedUrl: toEmbedUrl("rutube", embedId) };
    const videoMatch = url.pathname.match(/^\/video\/([a-zA-Z0-9]+)/);
    const videoId = videoMatch?.[1];
    if (videoId && RUTUBE_ID_RE.test(videoId)) {
      return { platform: "rutube", id: videoId, embedUrl: toEmbedUrl("rutube", videoId) };
    }
    return null;
  }

  return null;
}

export function toEmbedUrl(platform: VideoPlatform, id: string): string {
  return platform === "youtube"
    ? `https://www.youtube.com/embed/${id}`
    : `https://rutube.ru/play/embed/${id}`;
}

/** Домен встроенного embed-URL — используется классификаторами (demoKind,
 *  resolveFileViewerKind) чтобы отличить video-материал от прочих ссылок,
 *  не полагаясь на content_type (некоторые вызовы этих функций получают
 *  только url, без доступа к строке материала). */
export function isVideoEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtube.com" || host === "youtu.be" || host === "rutube.ru";
  } catch {
    return false;
  }
}
