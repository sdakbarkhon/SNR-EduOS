import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ParentChild } from "@/lib/parent-child";

export type { ParentChild } from "@/lib/parent-child";
export { SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-child";

/** Родитель + список его детей (в порядке привязки — старейшая связь первая = дефолтный ребёнок).
 *  cache() de-dup'ит вызов внутри одного запроса — layout.tsx и page.tsx оба
 *  зовут getParentContext(), без этого был бы двойной round-trip (перф-паттерн
 *  из apps/web/lib/cached-queries.ts). */
export const getParentContext = cache(async (): Promise<{
  parentId: string;
  parentName: string;
  children: ParentChild[];
  /**
   * true, если хотя бы один из трёх запросов ниже РЕАЛЬНО упал (сеть/RLS/
   * что угодно), а не просто вернул пусто. Раньше сбой и «детей действительно
   * нет» давали ОДИНАКОВЫЙ результат — `children: []` — и экраны (home/page.tsx,
   * ProgressView) показывали один и тот же текст «К аккаунту не привязан ни
   * один ребёнок» в обоих случаях. Это неотличимо на скриншоте: баг диагностики
   * (данные и RLS для parent_ismailov проверены живьём и корректны — см.
   * миграцию 163) и настоящий сбой выглядели бы для пользователя одинаково.
   * Этот флаг даёт экранам показать честное «Не удалось загрузить данные»
   * вместо вводящего в заблуждение «не привязан», если такое повторится.
   */
  hadError: boolean;
} | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let hadError = false;
  // Промт 6: логируем реальную ошибку на каждом из трёх запросов — раньше
  // РЕАЛЬНЫЙ сбой (RLS/сеть) был неотличим от "не родитель"/"нет детей" и
  // тихо уводил на /login. Не меняем сам fallback (null/[]) — эта функция
  // гейтит layout.tsx-редирект на /login для ВСЕХ /parent/* страниц, а
  // error.tsx-границы в приложении нет нигде вообще; превращать сбой в
  // необработанный throw здесь означало бы заменить редирект на голую
  // дефолтную страницу ошибки Next.js — не факт что лучше, и явно за
  // рамками "починить silent-fail" (это была бы новая архитектура
  // error-boundary). Логирование делает сбой хотя бы диагностируемым, а
  // hadError (см. выше) — ещё и видимым пользователю честным текстом.
  const { data: parent, error: parentErr } = await sb.from("parents").select("id, full_name").eq("user_id", user.id).single();
  if (parentErr) { console.error("[getParentContext] parents query failed:", parentErr.message); hadError = true; }
  if (!parent) return null;

  const { data: links, error: linksErr } = await sb
    .from("parent_students")
    .select("student_id, created_at")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  if (linksErr) { console.error("[getParentContext] parent_students query failed:", linksErr.message); hadError = true; }

  const studentIds = ((links ?? []) as { student_id: string; created_at: string }[]).map((l) => l.student_id);

  let children: ParentChild[] = [];
  if (studentIds.length > 0) {
    const { data: students, error: studentsErr } = await sb
      .from("students")
      .select("id, full_name, student_groups(groups(name))")
      .in("id", studentIds);
    if (studentsErr) { console.error("[getParentContext] students query failed:", studentsErr.message); hadError = true; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map<string, ParentChild>(
      ((students ?? []) as any[]).map((s) => {
        const groupNames: string[] = (s.student_groups ?? [])
          .map((sg: { groups: { name: string } | null }) => sg.groups?.name)
          .filter(Boolean);
        const className = groupNames.find((n) => n.includes("класс")) ?? groupNames[0] ?? null;
        return [s.id, { id: s.id, full_name: s.full_name, className }];
      }),
    );
    // Порядок привязки (parent_students.created_at ASC), не порядок ответа students.
    children = studentIds.map((id) => byId.get(id)).filter((c): c is ParentChild => Boolean(c));
  }

  return { parentId: parent.id, parentName: parent.full_name, children, hadError };
});
