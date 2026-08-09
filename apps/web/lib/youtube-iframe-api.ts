// 08.08.2026 — доступ к плееру YouTube для синхронизации показа.
//
// Обычные видеофайлы синхронизируются напрямую: у <video> читаются play/pause
// и currentTime (см. DemoMaterialContent.tsx, коммиты a445546 и 4220653).
// С YouTube так нельзя: ролик живёт в чужом iframe, и из-за политики
// одинакового источника ни состояние прочитать, ни методы вызвать снаружи
// невозможно. Единственный поддерживаемый путь — их собственный IFrame Player
// API: скрипт с www.youtube.com отдаёт объект-обёртку, который общается с
// плеером через postMessage.
//
// ГРУЗИМ ПО ТРЕБОВАНИЮ. Скрипт тянет ~70 КБ и открывает соединение с
// доменами YouTube. На странице урока ролик бывает не всегда, поэтому
// loadYouTubeApi() вызывается только когда на экране реально показывают
// YouTube-встраивание — то есть в ветке kind="embed" с youtube-адресом.
// Повторные вызовы переиспользуют один и тот же промис: второй <script> на
// странице сломал бы уже созданные плееры.
//
// RuTube сознательно не трогаем: подтверждённых данных по их плееру нет, а
// гадать на чужом недокументированном API — это молча сломать показ.

/** Минимум из YT.Player, которым мы пользуемся. Полные типы тянуть незачем —
 *  @types/youtube добавил бы зависимость ради четырёх методов. */
export type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

/** Состояния плеера — числа из документации IFrame API. */
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

type YTNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: { events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void } },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace & { loading?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loader: Promise<YTNamespace> | null = null;

/** Грузит IFrame Player API один раз за жизнь страницы и отдаёт неймспейс YT.
 *  Безопасно звать сколько угодно раз и из нескольких компонентов сразу. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube API нужен браузер"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loader) return loader;

  loader = new Promise<YTNamespace>((resolve, reject) => {
    // Скрипт зовёт ЭТУ глобальную функцию, когда готов, — другого сигнала он
    // не даёт. Прежний обработчик (если его успел поставить кто-то ещё)
    // вызываем следом, чтобы не отнять у него готовность.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API загрузился без YT.Player"));
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      loader = null; // дать шанс повторить, если сеть моргнула
      reject(new Error("Не удалось загрузить YouTube IFrame API"));
    };
    document.head.appendChild(script);
  });

  return loader;
}

/** Дописывает enablejsapi=1 к готовому адресу встраивания.
 *
 *  Адреса лежат в базе (lesson_materials.external_url, миграция 138) и
 *  меняются НЕ здесь: правка делается на рендере, поэтому старые записи
 *  начинают синхронизироваться без переписывания данных. origin — требование
 *  YouTube: без него часть браузеров глушит postMessage от плеера. */
export function withJsApi(embedUrl: string): string {
  try {
    const u = new URL(embedUrl);
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) return embedUrl;
    u.searchParams.set("enablejsapi", "1");
    if (typeof window !== "undefined") u.searchParams.set("origin", window.location.origin);
    return u.toString();
  } catch {
    return embedUrl;
  }
}

/** YouTube ли это встраивание. RuTube и прочие сюда не попадают. */
export function isYouTubeEmbed(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return /(^|\.)youtube(-nocookie)?\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
