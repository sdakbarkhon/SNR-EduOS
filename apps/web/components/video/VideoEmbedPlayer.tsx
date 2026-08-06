"use client";

// K.3, 05.08.2026 — универсальный inline-плеер для YouTube/RuTube/.mp4,
// для мест ВНЕ lesson_materials/Библиотеки кафедры (у тех уже есть свой
// путь через FileViewerModal + isVideoEmbedUrl, не трогаем). Используется
// там, где раньше был window.open или не было рендера вовсе.
import { VideoOff } from "lucide-react";
import { parseVideoUrl } from "@/lib/video-url";

export function VideoEmbedPlayer({ url, className }: { url: string; className?: string }) {
  const parsed = parseVideoUrl(url);

  if (!parsed) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 ${className ?? ""}`}>
        <VideoOff className="h-4 w-4 shrink-0" />
        Неподдерживаемая ссылка на видео. Поддерживаются: YouTube, RuTube, прямые .mp4 файлы
      </div>
    );
  }

  if (parsed.platform === "mp4") {
    return (
      <video
        controls
        src={parsed.embedUrl}
        className={`w-full rounded-lg shadow-md ${className ?? ""}`}
        style={{ maxHeight: 480 }}
      />
    );
  }

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-lg shadow-md ${className ?? ""}`}>
      <iframe
        src={parsed.embedUrl}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
