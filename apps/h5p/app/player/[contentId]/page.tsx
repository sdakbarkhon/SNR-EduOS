import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlayerClient } from "./PlayerClient";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  const db = await createClient();
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) redirect(`/login?next=/player/${contentId}`);

  const { data: content } = await db
    .from("h5p_content")
    .select("id, title, content_type")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) notFound();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", background: "white", boxShadow: "0 2px 8px rgba(93,80,150,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/library" style={{ color: "#7c5cff", fontWeight: 700, textDecoration: "none" }}>&larr; Библиотека</Link>
        <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{content.title}</h1>
      </div>
      <div style={{ flex: 1 }}>
        <PlayerClient contentId={content.id} />
      </div>
    </div>
  );
}
