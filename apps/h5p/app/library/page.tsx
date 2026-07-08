import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const db = await createClient();
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) redirect("/login?next=/library");

  const { data: contents } = await db
    .from("h5p_content")
    .select("id, title, content_type, is_public, created_at")
    .order("created_at", { ascending: false });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Библиотека H5P</h1>
          <p style={{ color: "#6f6f8c", marginTop: 4 }}>Готовые интерактивные задания</p>
        </div>
        <Link
          href="/editor"
          style={{
            background: "linear-gradient(135deg,#FF9A3D,#FF6B3D)", color: "white", fontWeight: 700,
            padding: "10px 18px", borderRadius: 12, textDecoration: "none", fontSize: 14,
          }}
        >
          + Создать задание
        </Link>
      </div>

      {(!contents || contents.length === 0) && (
        <div style={{ padding: 40, textAlign: "center", color: "#9a9ab5", background: "white", borderRadius: 16 }}>
          Пока нет заданий. Нажмите «Создать задание», чтобы добавить первое.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {(contents ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/player/${c.id}`}
            style={{
              display: "block", background: "white", borderRadius: 16, padding: 18,
              boxShadow: "0 4px 16px rgba(93,80,150,0.08)", textDecoration: "none", color: "inherit",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🧩</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#9a9ab5", marginTop: 4 }}>{c.content_type}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
