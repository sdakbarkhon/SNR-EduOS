import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncDataState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  /** Promise resolves once this refresh settles (data ИЛИ error) — awaitable
   *  для мест, которым нужно знать, когда данные реально готовы (Заход 1:
   *  verifyCode() ждёт реальный список детей перед переходом на childPicker,
   *  а не просто дёргает refresh "в фоне"). Существующие вызовы без await
   *  продолжают работать как раньше. */
  refresh: () => Promise<void>;
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
  // Пока запрос в полёте, повторное «Повторить» новый запрос не шлёт. Раньше
  // защиты не было вовсе: кнопка ошибки остаётся нажимаемой весь запрос, и
  // каждый тап уходил в сеть заново. Ref, а не state — state коммитится
  // следующим кадром и от быстрых нажатий не спасает.
  const inFlight = useRef(false);

  const run = useCallback((isRefresh: boolean): Promise<void> => {
    if (isRefresh && inFlight.current) return Promise.resolve();
    inFlight.current = true;
    const myGen = ++generation.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    return fetcher()
      .then((result) => {
        if (generation.current !== myGen) return;
        setData(result);
      })
      .catch((e: unknown) => {
        if (generation.current !== myGen) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        inFlight.current = false;
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
