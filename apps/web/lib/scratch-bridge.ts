/**
 * Протокол обмена между нашей копией Scratch и платформой. Z-Scratch, 10.08.2026.
 *
 * ЗАЧЕМ. Родные кнопки редактора («Сохранить», «Мои работы», «Поделиться»)
 * рассчитаны на серверы scratch.mit.edu, к которым наша копия не подключена,
 * и писали «скоро». Заказчик решил не прятать их и не вешать свою панель
 * рядом, а перевести на нашу базу — поэтому в сборку внесена правка: кнопки
 * шлют событие наружу вместо обращения к Scratch.
 *
 * ПОЧЕМУ ЧЕРЕЗ postMessage, А НЕ ЧТЕНИЕМ ИЗ РАМКИ. Редактор живёт на
 * snr-scratch.vercel.app, платформа — на своём домене. Между разными доменами
 * браузер не даёт залезть в DOM рамки вообще: ни к движку, ни к чему-либо
 * ещё. postMessage — единственный законный канал, и он же не требует
 * сажать редактор на наш домен через проксирование.
 *
 * Файл общий для обеих сторон по смыслу: те же имена событий продублированы в
 * правке scratch-gui (см. scratch/snr-changes.patch). Держать их в одном
 * месте нельзя — это разные сборки, поэтому здесь описан контракт, а там
 * ссылка на него.
 */

/** Адрес нашей копии Scratch. Сообщения принимаются только от него. */
export const SCRATCH_ORIGIN = "https://snr-scratch.vercel.app";

/** Метка в каждом сообщении: на странице могут жить чужие рамки. */
export const FROM_SCRATCH = "snr-scratch";
export const FROM_PLATFORM = "snr-platform";

/** Редактор → платформа. */
export type ScratchOutgoing =
  /** Нажата «Сохранить». sb3 — содержимое файла проекта. */
  | { source: typeof FROM_SCRATCH; type: "save"; name: string; sb3: ArrayBuffer }
  /** Нажата «Поделиться» — то же плюс просьба показать работу классу. */
  | { source: typeof FROM_SCRATCH; type: "share"; name: string; sb3: ArrayBuffer }
  /** Нажата «Мои работы» — открыть список на стороне платформы. */
  | { source: typeof FROM_SCRATCH; type: "my-projects" }
  /** Редактор загрузился и готов принимать проект. */
  | { source: typeof FROM_SCRATCH; type: "ready" };

/** Платформа → редактор. */
export type ScratchIncoming =
  /** Открыть сохранённую работу. */
  | { source: typeof FROM_PLATFORM; type: "load"; name: string; sb3: ArrayBuffer }
  /** Итог сохранения — редактор показывает свою же плашку. */
  | { source: typeof FROM_PLATFORM; type: "save-result"; ok: boolean; error?: string };

/** Разбирает событие окна в наше сообщение. Чужие и кривые — отбрасываются
 *  молча: на странице бывают рамки других сервисов и расширения браузера. */
export function parseScratchMessage(e: MessageEvent): ScratchOutgoing | null {
  if (e.origin !== SCRATCH_ORIGIN) return null;
  const d = e.data as Partial<ScratchOutgoing> | null;
  if (!d || typeof d !== "object" || d.source !== FROM_SCRATCH) return null;
  switch (d.type) {
    case "ready":
    case "my-projects":
      return d as ScratchOutgoing;
    case "save":
    case "share": {
      const m = d as { name?: unknown; sb3?: unknown };
      if (typeof m.name !== "string" || !(m.sb3 instanceof ArrayBuffer)) return null;
      return d as ScratchOutgoing;
    }
    default:
      return null;
  }
}

/** Отправляет сообщение в рамку редактора. */
export function postToScratch(frame: HTMLIFrameElement | null, msg: ScratchIncoming): void {
  frame?.contentWindow?.postMessage(msg, SCRATCH_ORIGIN);
}

/** Ограничение на размер работы. Проекты Scratch с медиа бывают крупными, но
 *  50 МБ — уже не школьная работа, а случайно затащенное видео; отказ лучше
 *  молчаливого обрыва загрузки. */
export const MAX_SB3_BYTES = 50 * 1024 * 1024;
