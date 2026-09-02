// Имена групп при массовом создании. Пункт 227, 03.09.2026.
//
// ПОЧЕМУ ШАБЛОН, А НЕ «С 1 ПО 12». Живые имена групп 03.09.2026 распадаются
// на три семейства, и жёсткий диапазон покрывает только первое:
//
//   3-А класс, 7-А класс, 10-А класс      школьные классы
//   Science 1-класс, SNR Робототехника    предметные группы центра
//   G-7, W-5, Test Group                  короткие коды
//
// Учебному центру нужен не «первый–двенадцатый», а произвольный список.
// Поэтому основа формы — правимый список имён, а этот разбор лишь ЗАПОЛНЯЕТ
// его по шаблону. Что подставилось, человек видит и правит руками.

/** Место числа в шаблоне. */
export const GROUP_TEMPLATE_NUMBER = "{N}";
/** Место буквы класса. Русская «Б» — от слова «буква», не от буквы Б. */
export const GROUP_TEMPLATE_LETTER = "{Б}";

/**
 * Потолок на одну подстановку.
 *
 * Не из осторожности ради осторожности: диапазон «с 1 по 999» с тремя
 * буквами — это 2997 групп и 5994 ветки чата, набранные тремя опечатками.
 * Список показывается человеку целиком, и три тысячи строк в нём — не показ,
 * а стена. Двести — заведомо больше любой школы (двенадцать классов по пять
 * букв это шестьдесят).
 */
export const GROUP_BULK_MAX = 200;

export type GroupNameTemplate = {
  /** Например «{N}-{Б} класс». Может не содержать мест вовсе — тогда выйдет
   *  один и тот же текст столько раз, сколько чисел в диапазоне; повторы
   *  отсеет уже сама форма. */
  pattern: string;
  from: number;
  to: number;
  /** Буквы классов. Пустой список — букв нет. */
  letters: string[];
};

/**
 * Разобрать строку букв: «А, Б, В» → ["А","Б","В"].
 *
 * Разделителями считаются запятая, точка с запятой и пробел — человек напишет
 * как привык, а не как мы задумали. Повторы и пустые куски отсеиваются,
 * порядок сохраняется.
 */
export function parseGroupLetters(raw: string): string[] {
  const куски = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const виденные = new Set<string>();
  const итог: string[] = [];
  for (const к of куски) {
    const ключ = к.toLowerCase();
    if (виденные.has(ключ)) continue;
    виденные.add(ключ);
    итог.push(к);
  }
  return итог;
}

/**
 * Подставить одно число и одну букву в шаблон.
 *
 * БУКВ МОЖЕТ НЕ БЫТЬ ВОВСЕ, и тогда «{N}-{Б} класс» обязано дать «1 класс»,
 * а не «1- класс». Поэтому место буквы убирается ВМЕСТЕ с дефисом прямо
 * перед ним, если он там есть. Правило простое и предсказуемое: другие
 * разделители не трогаем, чтобы «Science {N}-класс» не пострадал.
 */
export function fillGroupTemplate(pattern: string, n: number, letter: string): string {
  let итог = pattern;
  if (letter) {
    итог = итог.split(GROUP_TEMPLATE_LETTER).join(letter);
  } else {
    итог = итог.split("-" + GROUP_TEMPLATE_LETTER).join("");
    итог = итог.split(GROUP_TEMPLATE_LETTER).join("");
  }
  return итог.split(GROUP_TEMPLATE_NUMBER).join(String(n)).trim();
}

export type GroupNamesExpansion = {
  names: string[];
  /** Сколько имён шаблон дал бы без потолка. Больше `names.length` — значит
   *  список обрезан, и молчать об этом нельзя. */
  wouldBe: number;
};

/**
 * Развернуть шаблон в список имён.
 *
 * Диапазон в обратную сторону («с 12 по 1») читается как прямой: человек
 * ошибся полями, а не захотел обратного порядка. Отрицательные и нулевые
 * числа допускаются как есть — школа вправе назвать группу «0-А».
 */
export function expandGroupNames(t: GroupNameTemplate): GroupNamesExpansion {
  const от = Math.min(t.from, t.to);
  const до = Math.max(t.from, t.to);
  const буквы = t.letters.length ? t.letters : [""];
  const всего = (до - от + 1) * буквы.length;

  const names: string[] = [];
  for (let n = от; n <= до; n += 1) {
    for (const б of буквы) {
      if (names.length >= GROUP_BULK_MAX) return { names, wouldBe: всего };
      const имя = fillGroupTemplate(t.pattern, n, б);
      if (имя) names.push(имя);
    }
  }
  return { names, wouldBe: всего };
}

/** Ключ сравнения имён: буква в букву как assertGroupNameFree в вебе и как
 *  уникальный индекс из миграции 249 — lower(btrim(name)). */
export function groupNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export type GroupNamesCheck = {
  /** Что реально заведётся. */
  fresh: string[];
  /** Уже есть в школе. */
  taken: string[];
  /** Повторяется внутри самого списка. */
  duplicated: string[];
};

/**
 * Разложить список имён на «заведётся», «занято» и «повтор в списке».
 *
 * Считается на клиенте: все группы школы уже лежат на странице, второго
 * запроса за занятостью нет и заводить его незачем.
 *
 * ТРИ КУЧКИ, А НЕ ДВЕ. «Занято» и «повтор в списке» — разные новости:
 * первое значит «такая группа уже есть», второе — «вы написали одно имя
 * дважды». Свалить их в одну кучу значит сказать человеку неправду про
 * половину случаев.
 */
export function checkGroupNames(names: string[], existing: string[]): GroupNamesCheck {
  const занято = new Set(existing.map(groupNameKey));
  const виденные = new Set<string>();
  const итог: GroupNamesCheck = { fresh: [], taken: [], duplicated: [] };
  for (const сырое of names) {
    const имя = сырое.trim();
    if (!имя) continue;
    const ключ = groupNameKey(имя);
    if (виденные.has(ключ)) { итог.duplicated.push(имя); continue; }
    виденные.add(ключ);
    if (занято.has(ключ)) { итог.taken.push(имя); continue; }
    итог.fresh.push(имя);
  }
  return итог;
}

/**
 * Сколько веток чата заведётся.
 *
 * ДВЕ НА ГРУППУ: классная «{Имя}» и родительская «{Имя} — Родители», обе
 * кладёт триггер tg_group_created. Замерено на живой базе 03.09.2026: одна
 * группа — ровно +2 ветки, двенадцать — ровно +24.
 *
 * УЧАСТНИКОВ НОЛЬ, и это не «потому что учеников нет», а глубже: машина
 * личных чатов висит на subjects (tg_subject_teacher_direct_chats), а не на
 * groups. В новой группе нет ни предметов, ни учителей — она не запускается
 * вовсе. Тоже замерено: участников ровно +0.
 */
export const CHAT_THREADS_PER_GROUP = 2;

export function chatThreadsForGroups(count: number): number {
  return count * CHAT_THREADS_PER_GROUP;
}
