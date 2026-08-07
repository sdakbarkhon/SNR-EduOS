// 07.08.2026 — фильтры материалов группы по дате урока, уроку и предмету.
//
// Зачем. После автопубликации (миграция 174) материалы группы наполняются
// автоматически после каждого урока: в демо-школе это 501 запись за 8 дней,
// по 18 уроков в день. Общим списком нужное не найти.
//
// Почему отдельный модуль, а не логика в компонентах. Списков два —
// ученический MaterialsView и учительский TeacherMaterialsView, — и сводить
// их в один компонент задача прямо запрещает. Но правила фильтрации у них
// должны быть одинаковые, иначе разъедутся, как уже разъезжался резолв ссылок
// на материал (три копии, коммит 67748ce). Здесь только чистые функции, UI у
// каждого экрана свой.
//
// Дата берётся ПО УРОКУ (lesson.starts_at), а не по created_at записи: строка
// создаётся в момент завершения урока или бэкфиллом, и её created_at к дате
// занятия отношения не имеет — у 30 записей ретроспективы он вообще один и
// тот же.

const TZ_MS = 5 * 60 * 60 * 1000; // Ташкент, фиксированное смещение

export type FilterableMaterial = {
  subject: string | null;
  lesson?: { id: string; title: string | null; topic: string | null; starts_at: string } | null;
};

export type MaterialFilters = {
  /** YYYY-MM-DD ташкентской даты урока, либо "all". */
  date: string;
  /** lessons.id, либо "all". */
  lesson: string;
  /** course_materials.subject, либо "all". */
  subject: string;
};

export const ALL_FILTERS: MaterialFilters = { date: "all", lesson: "all", subject: "all" };

/** Ташкентская дата урока (YYYY-MM-DD) или null, если материал не привязан. */
export function lessonDayKey(m: FilterableMaterial): string | null {
  if (!m.lesson?.starts_at) return null;
  return new Date(new Date(m.lesson.starts_at).getTime() + TZ_MS).toISOString().slice(0, 10);
}

/** «29.07.2026» из YYYY-MM-DD. */
export function formatDayLabel(dayKey: string): string {
  const [y, mo, d] = dayKey.split("-");
  return `${d}.${mo}.${y}`;
}

/** Человекочитаемое имя урока для выпадающего списка. */
export function lessonLabel(m: FilterableMaterial): string {
  const l = m.lesson;
  if (!l) return "";
  const name = l.title ?? l.topic ?? "";
  const time = new Date(new Date(l.starts_at).getTime() + TZ_MS).toISOString().slice(11, 16);
  const subj = m.subject ? ` · ${m.subject}` : "";
  return name ? `${time} — ${name}${subj}` : `${time}${subj}`;
}

export type FilterOptions = {
  /** Даты уроков, за которые есть материалы. Свежие сверху. */
  dates: Array<{ key: string; label: string; count: number }>;
  /** Уроки — суженные выбранной датой, если она выбрана. */
  lessons: Array<{ id: string; label: string; count: number }>;
  subjects: string[];
  /** Есть ли записи без привязки к уроку — от этого зависит, показывать ли
   *  отдельный пункт «Общие материалы». */
  hasUnlinked: boolean;
};

/**
 * Варианты для выпадающих списков. Уроки сужаются уже выбранной датой, чтобы
 * учитель не листал 144 урока недели ради одного дня. Предметы и даты от
 * выбора не зависят — иначе фильтр было бы не «расширить» обратно.
 */
export function buildFilterOptions(
  materials: FilterableMaterial[],
  selectedDate: string,
): FilterOptions {
  const dateCounts = new Map<string, number>();
  const lessonCounts = new Map<string, { label: string; count: number }>();
  const subjects = new Set<string>();
  let hasUnlinked = false;

  for (const m of materials) {
    const day = lessonDayKey(m);
    if (day) dateCounts.set(day, (dateCounts.get(day) ?? 0) + 1);
    else hasUnlinked = true;

    if (m.subject) subjects.add(m.subject);

    if (m.lesson && (selectedDate === "all" || day === selectedDate)) {
      const prev = lessonCounts.get(m.lesson.id);
      lessonCounts.set(m.lesson.id, {
        label: prev?.label ?? lessonLabel(m),
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  return {
    dates: Array.from(dateCounts.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // свежие сверху
      .map(([key, count]) => ({ key, label: formatDayLabel(key), count })),
    lessons: Array.from(lessonCounts.entries())
      .map(([id, v]) => ({ id, label: v.label, count: v.count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    subjects: Array.from(subjects).sort((a, b) => a.localeCompare(b)),
    hasUnlinked,
  };
}

/**
 * Подходит ли материал под фильтры.
 *
 * ВАЖНО про записи без урока: их не теряет ни один фильтр, кроме явно
 * выбранной даты или урока. Пока дата = «все», материал без привязки виден
 * всегда — иначе загруженные вручную файлы молча исчезли бы из списка.
 */
export function matchesFilters(m: FilterableMaterial, f: MaterialFilters): boolean {
  if (f.subject !== "all" && m.subject !== f.subject) return false;
  if (f.date !== "all" && lessonDayKey(m) !== f.date) return false;
  if (f.lesson !== "all" && m.lesson?.id !== f.lesson) return false;
  return true;
}

/** Ключ группировки списка: дата урока, либо «без урока» в конце. */
export const UNLINKED_GROUP = "__unlinked__";

/**
 * Группировка отфильтрованного списка по дате урока, свежие сверху, а внутри
 * даты — по уроку (по времени начала). Материалы без урока — одной группой в
 * конце, чтобы не растворялись между датами.
 */
export function groupByDay<T extends FilterableMaterial>(
  materials: T[],
): Array<{ key: string; label: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const m of materials) {
    const key = lessonDayKey(m) ?? UNLINKED_GROUP;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === UNLINKED_GROUP) return 1;
    if (b === UNLINKED_GROUP) return -1;
    return a < b ? 1 : -1;
  });

  return sortedKeys.map((key) => ({
    key,
    label: key === UNLINKED_GROUP ? "Общие материалы" : formatDayLabel(key),
    items: (groups.get(key) ?? []).sort((x, y) => {
      const tx = x.lesson?.starts_at ?? "";
      const ty = y.lesson?.starts_at ?? "";
      return tx.localeCompare(ty);
    }),
  }));
}
