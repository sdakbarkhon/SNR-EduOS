import { redirect } from "next/navigation";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.1 — "Библиотека" merged into "База знаний"
// (/knowledge-base, "Библиотека" tab). BooksView.tsx is still used from
// there — kept in place, just no longer routed here directly, so old
// bookmarks/links don't 404.
export default function BooksPage() {
  redirect("/knowledge-base");
}
