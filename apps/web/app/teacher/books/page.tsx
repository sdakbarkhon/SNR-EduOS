import { redirect } from "next/navigation";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.1 — "Библиотека" merged into "База знаний"
// (/teacher/knowledge-base, "Библиотека" tab). TeacherBooksView.tsx is
// still used from there — kept in place, just no longer routed here
// directly, so old bookmarks/links don't 404.
export default function TeacherBooksPage() {
  redirect("/teacher/knowledge-base");
}
