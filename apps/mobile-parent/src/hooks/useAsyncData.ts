import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncDataState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  refresh: () => void;
};

/** Явный fetch-статус для экрана: loading (первая загрузка) / refreshing
 *  (pull-to-refresh) / error (показать "Не удалось загрузить" + retry) /
 *  data. НИКОГДА не глотает ошибку молча (.catch(() => [])) — именно этот
 *  паттерн уже дважды ломал веб (расписание "Выходной", пустые оценки),
 *  здесь supabase-ошибка всегда попадает в error и рендерится пользователю. */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const generation = useRef(0);

  const run = useCallback((isRefresh: boolean) => {
    const myGen = ++generation.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (generation.current !== myGen) return;
        setData(result);
      })
      .catch((e: unknown) => {
        if (generation.current !== myGen) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (generation.current !== myGen) return;
        setLoading(false);
        setRefreshing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => run(true), [run]);

  return { data, loading, refreshing, error, refresh };
}
