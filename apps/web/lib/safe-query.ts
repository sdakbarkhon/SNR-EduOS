// Промт 6 — аудит silent-fail queries. Реплейсмент для повторявшегося по
// файлам локального `safe(promise, fallback)`, который глотал ошибки БЕЗ
// логирования и БЕЗ сигнала для UI — ровно паттерн, дважды приведший к
// прод-багам ("Выходной" вместо расписания, пустые оценки). Логирует
// реальную ошибку (диагностируемо) И возвращает failed-флаг, чтобы
// страница могла показать ErrorState вместо пустого состояния.
export async function safeQuery<T>(
  promise: PromiseLike<T>,
  fallback: T,
  label: string,
): Promise<{ data: T; failed: boolean }> {
  try {
    return { data: await (promise as Promise<T>), failed: false };
  } catch (e) {
    console.error(`[${label}] failed:`, (e as Error)?.message ?? e);
    return { data: fallback, failed: true };
  }
}
