// Client-safe: no "next/headers"/server imports. Split out of parent-context.ts
// so client components (e.g. ParentTopbar) can import the cookie name/type/
// resolver without pulling createClient()'s server-only module into the
// client bundle (that broke the build: "next/headers" in a client chain).

export type ParentChild = { id: string; full_name: string; className: string | null };

export const SELECTED_CHILD_COOKIE = "parent_selected_child";

/** Выбранный ребёнок из списка по запрошенному ID. null = не найден (не свой ребёнок → 404 у вызывающего). */
export function resolveSelectedChild(
  children: ParentChild[],
  requestedId: string | null | undefined,
): ParentChild | null {
  if (requestedId) {
    return children.find((c) => c.id === requestedId) ?? null;
  }
  return children[0] ?? null;
}
