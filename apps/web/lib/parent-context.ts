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
} | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: parent } = await sb.from("parents").select("id, full_name").eq("user_id", user.id).single();
  if (!parent) return null;

  const { data: links } = await sb
    .from("parent_students")
    .select("student_id, created_at")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });

  const studentIds = ((links ?? []) as { student_id: string; created_at: string }[]).map((l) => l.student_id);

  let children: ParentChild[] = [];
  if (studentIds.length > 0) {
    const { data: students } = await sb
      .from("students")
      .select("id, full_name, student_groups(groups(name))")
      .in("id", studentIds);

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

  return { parentId: parent.id, parentName: parent.full_name, children };
});
