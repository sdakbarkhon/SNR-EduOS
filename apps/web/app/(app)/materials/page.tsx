import { redirect } from "next/navigation";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.1 — "Учебные материалы" merged into "База
// знаний" (/knowledge-base, "Материалы группы" tab). MaterialsView.tsx is
// still used from there — kept in place, just no longer routed here
// directly, so old bookmarks/links don't 404.
export default function MaterialsPage() {
  redirect("/knowledge-base");
}
