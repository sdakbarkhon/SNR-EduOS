import { redirect } from "next/navigation";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.1 — "Материалы" merged into "База знаний"
// (/teacher/knowledge-base, "Материалы группы" tab). TeacherMaterialsView.tsx
// is still used from there — kept in place, just no longer routed here
// directly, so old bookmarks/links don't 404.
export default function TeacherMaterialsPage() {
  redirect("/teacher/knowledge-base");
}
