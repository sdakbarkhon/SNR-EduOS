import { useMemo } from "react";
import type { Db } from "@snr/core";
import type { ChildPickerItem } from "../ui";
import type { ChildRow } from "../data";
import { toChildRow } from "../lib/realChild";
import { useParentData } from "../context/ParentDataContext";
import { useAppLocale } from "../i18n";
import { useAsyncData, type AsyncDataState } from "./useAsyncData";
import { getSupabase } from "../lib/supabase";

/**
 * Выбранный ребёнок и переключатель — в одном месте.
 *
 * ЗАЧЕМ. Четыре экрана этого захода (дневник, тесты, библиотека, учителя)
 * показывают карточку ребёнка и шторку выбора. Раньше каждый такой экран
 * собирал `pickerItems` у себя — по 20 строк на экран, и все четыре завели бы
 * свою копию палитры, подписи класса и обработчика выбора. Здесь один вариант
 * на всех; экраны берут готовое.
 *
 * Демо-ветки тут нет намеренно: демо-вход удалён целиком (см. шапку
 * AuthSessionContext), детей даёт только настоящая привязка родителя.
 */
export function useChildScope(): {
  /** id выбранного ребёнка; null — у родителя нет ни одного привязанного. */
  childId: string | null;
  /** Ребёнок в форме, которую уже умеет рисовать вёрстка (аватар, класс). */
  child: ChildRow | null;
  pickerItems: ChildPickerItem[];
  selectChild: (id: string) => void;
  /** Идёт первая загрузка родителя с детьми. */
  loading: boolean;
} {
  const { data, loading, selectedChildId, selectChild } = useParentData();
  const { d } = useAppLocale();
  const classWord = d.parentApp.grades.class;

  const children = data?.children ?? [];
  // find, а не прижатый к нулю индекс: при промахе выдавался ПЕРВЫЙ ребёнок
  // семьи вместо выбранного (28.08.2026). Не нашли — ребёнка нет, и вызывающий
  // это уже умеет разбирать: child объявлен nullable с самого начала.
  const index = children.findIndex((c) => c.id === selectedChildId);
  const child = index >= 0 ? toChildRow(children[index], index) : null;

  const pickerItems = useMemo<ChildPickerItem[]>(
    () =>
      children.map((c, i) => {
        const row = toChildRow(c, i);
        return {
          id: row.id,
          initials: row.first_name.slice(0, 1),
          gradient: row.avatar_gradient,
          ringColor: row.avatar_ring,
          name: row.full_name,
          classLabel: `${row.class_name} ${classWord}`,
          // Статуса «в школе/дома» в базе нет — пилюлю не выдумываем.
          statusLabel: "—",
          statusTone: "gray" as const,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, classWord],
  );

  return { childId: child?.id ?? null, child, pickerItems, selectChild, loading };
}

/**
 * Запрос, привязанный к выбранному ребёнку: перезапрашивается при смене
 * ребёнка и не уходит вовсе, пока ребёнок не известен.
 *
 * `extraDeps` — то, от чего запрос зависит помимо ребёнка (например, неделя
 * дневника). Передаётся отдельным массивом, чтобы вызывающий не собирал
 * список зависимостей руками и не забыл в нём ребёнка.
 */
export function useChildQuery<T>(
  childId: string | null,
  fetcher: (db: Db, childId: string) => Promise<T>,
  extraDeps: ReadonlyArray<unknown> = [],
): AsyncDataState<T | null> {
  return useAsyncData<T | null>(
    () => (childId ? fetcher(getSupabase(), childId) : Promise.resolve(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childId, ...extraDeps],
  );
}
