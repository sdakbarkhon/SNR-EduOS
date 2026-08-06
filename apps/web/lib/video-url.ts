// Пачка 4 — парсинг ссылок на видео (YouTube/RuTube) для материалов урока.
// Поддерживаемые форматы:
//   YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
//   RuTube:  rutube.ru/video/ID/, rutube.ru/play/embed/ID
//   mp4:     любой URL, заканчивающийся на .mp4 (без учёта query) — K.3, 05.08.2026
// Параметры вида ?t=15s, &list=... игнорируются — извлекаем только ID.
//
// K.3 — добавлен 'mp4' как platform. Сигнатуры parseVideoUrl()/toEmbedUrl()
// НЕ менялись (объект {platform,id,embedUrl}, toEmbedUrl(platform,id)) —
// намеренно, у них уже есть живые вызывающие места (FileViewerModal.tsx,
// KnowledgeBaseFilePicker.tsx/LibraryVideoLinkModal), которые полагаются на
// эту форму для lesson_materials/Библиотеки кафедры — эту логику явно
// просили не трогать. mp4 просто добавлен как ещё один вариант platform,
// id/embedUrl для него — сам исходный URL (нет отдельного embed-варианта).

export type VideoPlatform = "youtube" | "rutube" | "mp4";
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

  // .mp4 — до провайдер-специфичной логики ниже: не привязан к хосту.
  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  if (withoutQuery.toLowerCase().endsWith(".mp4")) {
    return { platform: "mp4", id: trimmed, embedUrl: trimmed };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
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

/** K.3 — true если ссылка распознана как видео (YouTube/RuTube/.mp4). Для
 *  клиентской валидации форм — намеренно НЕ трогает isVideoEmbedUrl ниже
 *  (та классифицирует уже-embed-домены для FileViewerModal/lesson_materials,
 *  которую просили не трогать; расширять её на .mp4 нельзя — resolveFileViewerKind
 *  рендерит kind='embed' как <iframe>, что сломало бы <video>-случай). */
export function isVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

export function toEmbedUrl(platform: VideoPlatform, id: string): string {
  // YouTube "ошибка 153" ("Ошибка настройки видеопроигрывателя") —
  // youtube-nocookie.com — тот же embed-плеер без cookie-домена Google Ads,
  // который часто ломается блокировщиками рекламы на клиенте. rel=0 — без
  // чужих "похожих видео" в конце, modestbranding=1 — минимальный брендинг.
  if (platform === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&modestbranding=1&rel=0`;
  if (platform === "rutube") return `https://rutube.ru/play/embed/${id}`;
  // mp4 — нет отдельного embed-варианта, id уже сам исходный URL (см. parseVideoUrl).
  return id;
}

/** Домен встроенного embed-URL — используется классификаторами (demoKind,
 *  resolveFileViewerKind) чтобы отличить video-материал от прочих ссылок,
 *  не полагаясь на content_type (некоторые вызовы этих функций получают
 *  только url, без доступа к строке материала). */
export function isVideoEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    // youtube-nocookie.com — новый embed-домен (фикс ошибки 153, toEmbedUrl
    // выше); youtube.com остаётся для СТАРЫХ уже сохранённых embed-URL,
    // сгенерированных до этого фикса.
    return host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be" || host === "rutube.ru";
  } catch {
    return false;
  }
}
