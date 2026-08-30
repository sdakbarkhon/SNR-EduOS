import { getParentContext } from "@/lib/parent-context";
import { getSelectedChild, parentIsDemo } from "@/lib/parent-queries";
import { avatarGradient, avatarRing, givenNameLetter, initialsOf } from "../_ui/format";
import { ProfileView } from "./ProfileView";

/**
 * «Профиль» — реальные ФИО родителя и его ребёнка.
 *
 * Гард доступа (есть ли родительский контекст) уже стоит в
 * `parent/(app)/layout.tsx`, поэтому здесь `ctx` может быть null только в
 * гонке между редиректом и рендером — тогда показываем экран с пустым именем,
 * а не падаем.
 */
export default async function ParentProfilePage() {
  const [ctx, child, isDemo] = await Promise.all([
    getParentContext(),
    getSelectedChild(),
    parentIsDemo(),
  ]);

  const parentName = ctx?.parentName ?? "";
  const parentGradient = avatarGradient(ctx?.parentId ?? parentName);

  return (
    <ProfileView
      isDemo={isDemo}
      parentName={parentName}
      parentInitials={initialsOf(parentName)}
      parentGradient={parentGradient}
      child={
        child
          ? {
              fullName: child.full_name,
              classLabel: child.className ?? "Класс не указан",
              initials: givenNameLetter(child.full_name),
              gradient: avatarGradient(child.id),
              ring: avatarRing(avatarGradient(child.id)),
            }
          : null
      }
    />
  );
}
