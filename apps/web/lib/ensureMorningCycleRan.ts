// Фолбэк для утреннего цикла уроков — вызывается из RSC при загрузке
// страниц уроков/расписания. Гарантия: если Vercel Cron
// (/api/cron/morning-lesson-cycle) по какой-то причине не отработал в 09:00
// Ташкент (сбой, ретрай, тестовый прогон вне расписания), первый вход
// пользователя после 09:00 сам подтянет закрытие 1-го и старт 2-го урока.
//
// ВАЖНО:
//   - Работает от service-role (createAdminClient), т.к. может выполнять
//     UPDATE на уроках других классов (RLS этого не даст обычному юзеру).
//   - Идемпотентно (см. runMorningLessonCycle: guarded UPDATEs).
//   - Проверяет "сейчас Ташкент >= 09:00" — раньше 09:00 ничего не делает.
//   - Ошибки НЕ бросает — тихо логгирует. Никогда не должен уронить RSC.
//   - Кэш не нужен: сама функция дешёвая (SELECT первых двух уроков ×3
//     класса + guarded UPDATE'ы), не в критическом пути (fire-and-forget
//     ok'ей быть не может из RSC, но потери задержки минимальны).

import { createAdminClient } from "@/lib/supabase/admin";
import { runMorningLessonCycle } from "@/lib/runMorningLessonCycle";

const TZ_MS = 5 * 60 * 60 * 1000;
const NINE_AM_MS = 9 * 60 * 60 * 1000;

function tashkentSecondsSinceMidnight(nowMs: number = Date.now()): number {
  const tashkentNow = new Date(nowMs + TZ_MS);
  const secs =
    tashkentNow.getUTCHours() * 3600 + tashkentNow.getUTCMinutes() * 60 + tashkentNow.getUTCSeconds();
  return secs;
}

export async function ensureMorningCycleRan(): Promise<{ skipped: string } | { ok: true; actions: number }> {
  const nowSec = tashkentSecondsSinceMidnight();
  if (nowSec * 1000 < NINE_AM_MS) {
    return { skipped: "too early (Tashkent < 09:00)" };
  }
  try {
    const admin = createAdminClient();
    const res = await runMorningLessonCycle(admin);
    return { ok: true, actions: res.actions.length };
  } catch (e) {
    console.error("[ensureMorningCycleRan] failed:", (e as Error)?.message ?? e);
    return { skipped: `error: ${(e as Error)?.message ?? "unknown"}` };
  }
}
