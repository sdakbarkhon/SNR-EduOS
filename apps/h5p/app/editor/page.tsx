import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth";
import { EditorForm } from "./EditorForm";

export default async function EditorPage() {
  const db = await createClient();
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) redirect("/login?next=/editor");

  const role = await getCurrentUserRole(db, userData.user.id);
  if (role !== "teacher" && role !== "super_admin") {
    redirect("/library");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Создать задание</h1>
      <p style={{ color: "#6f6f8c", marginBottom: 24 }}>
        Memory Game — ученик переворачивает карточки и ищет пары. Загрузите 2–8 картинок.
      </p>
      <EditorForm />
    </div>
  );
}
