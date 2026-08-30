import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ParentChild } from "@/lib/parent-child";

export type { ParentChild } from "@/lib/parent-child";
export { SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-child";

/**
 * Родитель + список его детей (в порядке привязки — старейшая связь первая =
 * дефолтный ребёнок). cache() de-dup'ит вызов внутри одного запроса —
 * layout.tsx и page.tsx оба зовут getParentContext(), без этого был бы
 * двойной round-trip (перф-паттерн из apps/web/lib/cached-queries.ts).
 *
 * ПЕРФ (замер округом переходов /parent, задача «убрать 2-3 сек задержку»).
 * Раньше здесь было ДВА источника лишней сетевой задержки на КАЖДЫЙ переход:
 *
 *  1. `supabase.auth.getUser()` делает отдельный round-trip к Supabase Auth
 *     ради ревалидации JWT — тот же round-trip, что middleware уже избегает
 *     («Промт «скорость», Задача 4» в lib/supabase/middleware.ts: getSession()
 *     вместо getUser(), с тем же обоснованием — «поддельный/протухший JWT
 *     провалит не эту проверку, а саму RLS-политику на первом же реальном
 *     запросе»). Здесь то же самое: user.id ниже используется только как
 *     .eq()-фильтр для собственного удобства запроса, а не как решение о
 *     доступе — РЕАЛЬНУЮ авторизацию на каждой строке всё равно проверяет
 *     RLS-политика Postgres по auth.uid() из JWT, независимо от того, каким
 *     методом клиент этот JWT прочитал. getSession() декодирует и проверяет
 *     подпись JWT ЛОКАЛЬНО (без сети) — единственное, чего он не даёт по
 *     сравнению с getUser(), это ревалидация «пользователя не забанили/не
 *     удалили за последние N минут при ещё не истёкшем токене» — для этого
 *     внутреннего кабинета школы это несущественный риск на фоне сетевого
 *     round-trip на КАЖДЫЙ переход между вкладками.
 *  2. Три ПОСЛЕДОВАТЕЛЬНЫХ await: parents → parent_students → students —
 *     три отдельных HTTP-запроса к PostgREST один за другим, хотя все три
 *     связаны обычными FK и PostgREST умеет отдать их ОДНИМ запросом через
 *     вложенный select (то же самое embedding уже использовалось для
 *     student_groups(groups(name)) до этой правки — синтаксис не новый).
 *
 * На клиенте из Ташкента до Frankfurt (apps/web/vercel.json: regions: ["fra1"])
 * один round-trip — это реалистично 150–350ms сетевой задержки. Было:
 * getUser() + 3×round-trip = 4 последовательных round-trip. Стало: 1
 * (getSession — без сети) + 1 (один вложенный select) = 1 сетевой round-trip.
 * Экономия — 3 round-trip'а на КАЖДЫЙ переход /parent, где эта функция
 * вызывается (то есть все переходы, у всех — layout.tsx гейтит доступ ею же).
 */
export const getParentContext = cache(async (): Promise<{
  parentId: string;
  parentName: string;
  /**
   * Школа родителя. Z.3, заход 1 — единственное место, где школы в выборке
   * не было: у ученика и учителя она приходит сама (`select("*")` в
   * getMyStudent/getMyTeacher), здесь список колонок перечислен явно.
   * Нужна, чтобы узнать `schools.frozen_date` и отдать клиенту правильное
   * «сейчас». Лишнего запроса не добавляет — это ещё одна колонка в том же
   * вложенном select.
   */
  schoolId: string | null;
  /**
   * ДЕМО ЛИ ЭТО. Заход 1 по оплатам, 30.08.2026.
   *
   * Веб-родитель до сих пор не отличал демо-гостя от настоящего родителя
   * НИ В ОДНОМ месте — и следующим заходам, которые переводят оплаты на
   * настоящие счета, ветвиться было не по чему.
   *
   * Признак берётся у ШКОЛЫ (`schools.is_demo`), а не у родителя: демо-школа
   * одна и помечена в базе, а «демо-родитель» — это обычная строка `parents`
   * внутри неё. Тот же приём уже применён в lib/parent-google.ts.
   *
   * ЛИШНЕГО ЗАПРОСА НЕТ. Это ещё одна колонка во вложенном select, который
   * и так выполняется ниже одним round-trip: `parents → parent_students →
   * students → student_groups → groups`, к нему добавлено `schools(is_demo)`
   * по существующему FK `parents.school_id`. Ровно тем же способом сюда
   * когда-то попал сам `school_id`.
   *
   * ДЕМО-ВХОД НА ВЕБЕ ИДЁТ МИМО ОБЩЕГО МЕХАНИЗМА — кнопка «Посмотреть демо»
   * зовёт demoParentLogin() с зашитым номером +998912345678. Отдельной
   * обработки это не требует: тот вход выдаёт сессию НАСТОЯЩЕЙ строки
   * `parents` демо-школы, поэтому запрос ниже находит её так же, как любую
   * другую, и `is_demo` приходит true сам собой.
   *
   * false при отсутствии школы или сбое запроса: «не знаем» безопаснее
   * трактовать как «настоящий родитель» — тот же выбор умолчания, что у
   * getSchoolFrozenDate с заморозкой.
   */
  isDemo: boolean;
  /**
   * Контакты школы для шторки «как оплатить» (заход 2 по оплатам).
   *
   * Едут тем же вложенным select-ом, что и `is_demo`, — ещё три колонки в
   * уже существующем embed `schools(...)`, ни одного лишнего round-trip.
   *
   * `legal_details` (банковские реквизиты) СЮДА НЕ ВХОДИТ и намеренно пуст
   * в базе: реквизиты придут от заказчика. Шторка обязана выглядеть
   * законченно без них — телефоном и адресом, а не дырой на их месте.
   */
  school: { name: string; phone: string | null; address: string | null } | null;
  children: ParentChild[];
  /**
   * true, если запрос ниже РЕАЛЬНО упал (сеть/RLS/что угодно), а не просто
   * вернул пусто. Раньше сбой и «детей действительно нет» давали ОДИНАКОВЫЙ
   * результат — `children: []` — и экраны (home/page.tsx, ProgressView)
   * показывали один и тот же текст «К аккаунту не привязан ни один ребёнок»
   * в обоих случаях. Это неотличимо на скриншоте: баг диагностики (данные и
   * RLS для parent_ismailov проверены живьём и корректны — см. миграцию 163)
   * и настоящий сбой выглядели бы для пользователя одинаково. Этот флаг даёт
   * экранам показать честное «Не удалось загрузить данные» вместо вводящего
   * в заблуждение «не привязан», если такое повторится.
   */
  hadError: boolean;
} | null> => {
  const supabase = await createClient();
  // getSession(), а не getUser() — см. комментарий выше блока. Один и тот же
  // приём, что уже применён в middleware.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let hadError = false;

  // Один запрос вместо трёх: parents → parent_students → students →
  // student_groups → groups одним вложенным select. PostgREST резолвит
  // embedding по существующим FK (parent_students.parent_id → parents.id,
  // parent_students.student_id → students.id) — те же связи, которыми
  // раньше пользовались три отдельных запроса.
  //
  // Промт 6 (см. старую версию файла): раньше сбой на любом из трёх шагов
  // логировался отдельно с указанием, какой именно упал. Одним запросом
  // такой детализации нет — PostgREST либо вернёт полное дерево, либо
  // единую ошибку на весь select. hadError по-прежнему различает «сбой» от
  // «данных действительно нет», просто без разбивки по таблице.
  const { data: parent, error: parentErr } = await sb
    .from("parents")
    .select(
      "id, full_name, school_id, school:schools(is_demo, name, phone, address), parent_students(student_id, created_at, students(id, full_name, student_groups(groups(name))))",
    )
    .eq("user_id", user.id)
    .single();
  if (parentErr) { console.error("[getParentContext] parents+children query failed:", parentErr.message); hadError = true; }
  if (!parent) return null;

  type Row = {
    student_id: string;
    created_at: string;
    students: {
      id: string;
      full_name: string;
      student_groups: { groups: { name: string } | null }[] | null;
    } | null;
  };
  const links = ((parent.parent_students ?? []) as Row[])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at)); // старейшая связь первая = дефолтный ребёнок

  const children: ParentChild[] = links
    .map((l): ParentChild | null => {
      const s = l.students;
      if (!s) return null;
      const groupNames = (s.student_groups ?? [])
        .map((sg) => sg.groups?.name)
        .filter((n): n is string => Boolean(n));
      const className = groupNames.find((n) => n.includes("класс")) ?? groupNames[0] ?? null;
      return { id: s.id, full_name: s.full_name, className };
    })
    .filter((c): c is ParentChild => c !== null);

  return {
    parentId: parent.id,
    parentName: parent.full_name,
    schoolId: (parent as { school_id?: string | null }).school_id ?? null,
    isDemo: Boolean((parent as { school?: { is_demo?: boolean | null } | null }).school?.is_demo),
    school: (() => {
      const s = (parent as {
        school?: { name?: string | null; phone?: string | null; address?: string | null } | null;
      }).school;
      return s ? { name: s.name ?? "", phone: s.phone ?? null, address: s.address ?? null } : null;
    })(),
    children,
    hadError,
  };
});
