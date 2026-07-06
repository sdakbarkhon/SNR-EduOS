import type { Db } from "@snr/core";

export type ParentChild = { id: string; fullName: string; className: string | null };

type StudentRow = {
  id: string;
  full_name: string;
  student_groups: { groups: { name: string } | null }[] | null;
};

/** Дети родителя, в порядке привязки (parent_students.created_at ASC) —
 *  зеркалит apps/web/lib/parent-context.ts (там Next.js/cookies-специфика,
 *  здесь тот же RLS-фильтр через parent_students, только под mobile-клиент). */
export async function getMyChildren(db: Db, parentId: string): Promise<ParentChild[]> {
  // database.types.ts не перегенерирован после миграции 74 (parent_students) —
  // тот же обход, что и в apps/web/lib/parent-context.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = db as any;
  const { data: links } = await sb
    .from("parent_students")
    .select("student_id, created_at")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  const studentIds = ((links ?? []) as { student_id: string }[]).map((l) => l.student_id);
  if (studentIds.length === 0) return [];

  const { data: students } = await db
    .from("students")
    .select("id, full_name, student_groups(groups(name))")
    .in("id", studentIds);

  const byId = new Map<string, ParentChild>(
    ((students ?? []) as StudentRow[]).map((s) => {
      const groupNames = (s.student_groups ?? [])
        .map((sg) => sg.groups?.name)
        .filter((n): n is string => Boolean(n));
      const className = groupNames.find((n) => n.includes("класс")) ?? groupNames[0] ?? null;
      return [s.id, { id: s.id, fullName: s.full_name, className }];
    }),
  );
  return studentIds
    .map((id) => byId.get(id))
    .filter((c): c is ParentChild => Boolean(c));
}
