import { useState } from "react";
import type { ChildPickerItem } from "../ui";
import { defaultChildId, getChildren, type ChildRow } from "../data";
import { useAppLocale } from "../i18n";
import { useDemoSession } from "../context/DemoSessionContext";
import { useChildScope } from "./useChildScope";

/**
 * Выбранный ребёнок и переключатель — для экранов, у которых есть и настоящая
 * ветка, и витрина.
 *
 * ЗАЧЕМ. Заход 3 витрины трогает шесть экранов учёбы, и каждому нужно одно и
 * то же: в показе семья берётся из заготовок и выбранный ребёнок живёт в
 * локальном состоянии, при настоящем входе — всё как было, из useChildScope.
 * Шесть копий этой развилки разошлись бы; в этом проекте копии расходились
 * уже не раз.
 *
 * ЧТО ВАЖНО В ВОЗВРАЩАЕМОМ. Идентификаторов два, и путать их нельзя:
 *  · `childId` — кого показываем. В показе это выдуманный ребёнок;
 *  · `realChildId` — с чем идти в базу. В показе он null, и useChildQuery по
 *    null не стреляет. Передай туда `childId` — и идентификатор выдуманного
 *    ребёнка ушёл бы запросом в Postgres.
 *
 * При настоящем входе оба равны, и поведение экрана не меняется ни на шаг.
 */
export function useShowcaseChild(): {
  /** Идёт ли показ. Тот же признак, которым пользуется demoOr. */
  showcase: boolean;
  childId: string | null;
  realChildId: string | null;
  child: ChildRow | null;
  pickerItems: ChildPickerItem[];
  selectChild: (id: string) => void;
  loading: boolean;
} {
  const { d } = useAppLocale();
  const { isDemo: showcase } = useDemoSession();
  const {
    childId: realChildId,
    child: realChild,
    pickerItems: realPickerItems,
    selectChild: selectRealChild,
    loading,
  } = useChildScope();

  const [fixtureChildId, setFixtureChildId] = useState<string | null>(defaultChildId());
  const fixtureChildren = getChildren();

  if (!showcase) {
    return {
      showcase: false,
      childId: realChildId,
      realChildId,
      child: realChild,
      pickerItems: realPickerItems,
      selectChild: selectRealChild,
      loading,
    };
  }

  return {
    showcase: true,
    childId: fixtureChildId,
    // В показе в базу не ходим вовсе — отдаём null осознанно.
    realChildId: null,
    child: fixtureChildren.find((c) => c.id === fixtureChildId) ?? null,
    pickerItems: fixtureChildren.map((k) => ({
      id: k.id,
      initials: k.first_name.slice(0, 1),
      gradient: k.avatar_gradient,
      ringColor: k.avatar_ring,
      name: k.full_name,
      classLabel: `${k.class_name} ${d.parentApp.grades.class}`,
      // Подпись есть, тона нет. Выводить тон сравнением статуса с русской
      // строкой («В школе» → зелёный) — тот же класс ошибки, что уже ловили
      // на статусах уроков, и в новом коде мы его не заводим.
      statusLabel: k.status_chip,
      statusTone: "gray" as const,
    })),
    selectChild: setFixtureChildId,
    // Заготовкам грузиться неоткуда.
    loading: false,
  };
}
