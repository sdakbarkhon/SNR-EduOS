import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchSchoolFrozenDate, getParentContext, type ParentContext as ParentContextData } from "@snr/core";
import { getSupabase } from "../lib/supabase";
import { useAsyncData } from "../hooks/useAsyncData";
import { DEMO_TODAY, setDemoShowcase, setRealChildren } from "../data";
import { useDemoSession } from "./DemoSessionContext";
import { toChildRow } from "../lib/realChild";
import { setSchoolFrozenDate } from "../lib/appTime";

type Ctx = {
  data: ParentContextData | null;
  loading: boolean;
  error: Error | null;
  /** Заход 1: awaitable (useAsyncData.refresh теперь Promise<void>) — auth-flow
   *  ждёт реальных детей перед переходом на childPicker, а не дёргает вслепую. */
  refresh: () => Promise<void>;
  selectedChildId: string | null;
  /** Заход 2, шаг 1: id: null — сброс выбора (см. AuthSessionContext.signOut()).
   *  Без сброса selectedChildId переживает signOut() (этот провайдер не
   *  размонтируется вместе с ним) и указывает на ребёнка ПРЕЖНЕЙ семьи после
   *  повторного входа под другим тестовым номером в той же живой сессии —
   *  auto-select useEffect ниже сработает заново только если id снова null. */
  selectChild: (id: string | null) => void;
};

const ParentDataContext = createContext<Ctx | null>(null);

/** Родитель+дети — загружаются ОДИН раз здесь (не в каждом из 7 экранов) и
 *  раздаются через контекст. Селектор ребёнка живёт тут же: >1 ребёнка —
 *  переключатель работает, 1 (или 0) — переключать нечего. */
export function ParentDataProvider({ children }: { children: ReactNode }) {
  // ПРИЗНАК ПОКАЗА. Тот же источник, которым пользуется demoOr. С 29.08.2026
  // это локальный ключ в защищённом хранилище (см. DemoSessionContext), а не
  // ключ аренды демо-места: показ больше не зависит ни от сети, ни от базы.
  //
  // Стоит ВЫШЕ запроса намеренно: именно он решает, идти ли в базу вообще.
  //
  // Не путать с session.demoParentId: то поле НИКОГДА не выставлялось
  // (единственное присваивание — null в INITIAL_STATE), и все проверки по нему
  // всегда были ложны. Найдено сквозной сверкой 28.08.2026.
  const { isDemo, demoReady } = useDemoSession();

  // Дата заморозки школы едет тем же заходом, что и родитель с детьми: время
  // приложения должно быть известно к моменту, когда появятся первые экраны с
  // датами, а не догонять их вторым запросом.
  const state = useAsyncData(async () => {
    // ПОКАЗ БАЗЫ НЕ КАСАЕТСЯ ВОВСЕ (29.08.2026).
    //
    // Раньше запрос уходил безусловно, а демо-гость входил настоящим
    // родителем демо-школы — и получал сюда настоящих детей. Дальше по
    // цепочке `isRealFlow = !session.demoParentId && !!parentData && ...`
    // становился ИСТИНОЙ на восьми экранах, и вместо витрины человек видел
    // базу: главная, успехи, профиль, задания, детали задания, посещаемость,
    // расписание, профиль ребёнка.
    //
    // Теперь parentData в показе остаётся null — и те же восемь экранов
    // сами уходят в свою ветку заготовки. Ни одного из них править не
    // пришлось: ветка в них всё это время была на месте, просто недостижима.
    //
    // Пока признак ещё читается с диска, в базу тоже не идём: запрос ушёл бы
    // на долю секунды раньше ответа «показ идёт» — и ушёл бы зря.
    if (!demoReady) return null;
    if (isDemo) {
      // Время показа — из заготовки, а не из schools.frozen_date. Заготовки
      // расписания и статуса дня написаны вокруг этой даты; возьми мы
      // настоящее «сегодня», подписи дней разошлись бы с содержимым.
      //
      // Выставить обязательно: без этого дата школы остаётся «ещё не
      // загружали», isSchoolTimeReady() навсегда false, и экраны, которые
      // её ждут (useTashkentToday, детальный статус дня), ждали бы вечно.
      setSchoolFrozenDate(DEMO_TODAY.iso_date);
      return null;
    }
    const db = getSupabase();
    const [parent, frozen] = await Promise.all([
      getParentContext(db),
      fetchSchoolFrozenDate(db),
    ]);
    setSchoolFrozenDate(frozen);
    return parent;
  }, [demoReady, isDemo]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Признак показа — в слой данных: по нему аксессоры решают, подставлять ли
  // заготовку вместо отсутствующего ребёнка. Демо-гостю витрина нужна
  // прежней, настоящему родителю — ничего.
  useEffect(() => {
    setDemoShowcase(isDemo);
  }, [isDemo]);

  // Настоящие дети — в слой данных, чтобы имена стали настоящими на всех
  // экранах сразу, включая оплаты (см. setRealChildren в data/index.ts).
  useEffect(() => {
    setRealChildren(state.data ? state.data.children.map(toChildRow) : null);
  }, [state.data]);

  useEffect(() => {
    if (state.data && state.data.children.length > 0 && !selectedChildId) {
      setSelectedChildId(state.data.children[0].id);
    }
  }, [state.data, selectedChildId]);

  const value = useMemo<Ctx>(
    () => ({
      data: state.data,
      loading: state.loading,
      error: state.error,
      refresh: state.refresh,
      selectedChildId,
      selectChild: setSelectedChildId,
    }),
    [state.data, state.loading, state.error, state.refresh, selectedChildId],
  );

  return <ParentDataContext.Provider value={value}>{children}</ParentDataContext.Provider>;
}

export function useParentData(): Ctx {
  const ctx = useContext(ParentDataContext);
  if (!ctx) throw new Error("useParentData must be used within ParentDataProvider");
  return ctx;
}

export function useSelectedChild() {
  const { data, selectedChildId } = useParentData();
  return data?.children.find((c) => c.id === selectedChildId) ?? null;
}
