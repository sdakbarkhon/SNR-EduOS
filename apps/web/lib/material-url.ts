// 07.08.2026 — единый резолв ссылки на материал урока.
//
// Зачем отдельный модуль. Одну и ту же логику независимо писали в трёх местах,
// и они успели разъехаться:
//   * app/(app)/lessons/[id]/page.tsx — серверный расчёт materialUrls ученику;
//   * TeacherLessonDetailView.tsx — клиентский резолв для панели показа;
//   * LessonWorkspaceView.tsx — ученик берёт готовое из materialUrls.
// Учительская копия отстала от остальных и не знала про content_type
// 'video_mp4' с отдельным бакетом lesson-videos (K.1, миграция 167) — из-за
// этого учитель не видел собственную демонстрацию (коммит 4220653). Чтобы
// расхождение не случилось в третий раз, правила живут здесь.
//
// Три случая:
//   1) video_youtube / video_rutube — файла в Storage нет, embed-адрес уже
//      лежит на записи;
//   2) любая другая запись без file_storage_path — тоже внешняя ссылка;
//   3) файл в Storage — signed URL; бакет для video_mp4 это lesson-videos,
//      для остального kb_bucket ?? lesson-materials.
//
// ВАЖНО про срок жизни: getLessonMaterialUrl подписывает ссылку на ЧАС.
// Поэтому резолвить надо в момент показа, а не один раз при загрузке
// страницы — иначе у зрителя, открывшего урок больше часа назад, ссылка уже
// мертва (см. комментарий в LessonWorkspaceView).

import { getLessonMaterialUrl } from "@snr/core";
import type { Db } from "@snr/core";

export type ResolvableMaterial = {
  content_type: string | null;
  external_url: string | null;
  file_storage_path: string | null;
  kb_bucket?: string | null;
};

/** Бакет Storage для материала. Экспортируется отдельно — серверный путь
 *  считает ссылки батчем и использует только эту часть. */
export function materialBucket(mat: ResolvableMaterial): string {
  return mat.content_type === "video_mp4" ? "lesson-videos" : (mat.kb_bucket ?? "lesson-materials");
}

/** Ссылка для показа материала. null — показать нечего. */
export async function resolveMaterialUrl(db: Db, mat: ResolvableMaterial): Promise<string | null> {
  if (mat.content_type === "video_youtube" || mat.content_type === "video_rutube") {
    return mat.external_url;
  }
  if (!mat.file_storage_path) return mat.external_url;
  try {
    return await getLessonMaterialUrl(db, mat.file_storage_path, undefined, materialBucket(mat));
  } catch {
    return null;
  }
}
