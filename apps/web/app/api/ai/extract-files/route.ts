import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractText, mimeFromName, isExtractable } from "@/lib/file-extractors";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOTAL = 100_000; // total char cap across all files

export async function POST(req: NextRequest) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must be a teacher.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const { lessonId } = (await req.json()) as { lessonId?: string };
  if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

  // Verify this teacher owns the lesson (lessons → group.teacher_id).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson } = await (db as any)
    .from("lessons")
    .select("group:groups!inner(teacher_id)")
    .eq("id", lessonId)
    .single();
  const ownerTeacherId = (lesson?.group as { teacher_id: string } | null)?.teacher_id;
  if (!lesson || ownerTeacherId !== teacher.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Per-lesson attachments live in lesson_materials (bucket "lesson-materials").
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: materials, error } = await (admin as any)
    .from("lesson_materials")
    .select("id, title, file_storage_path, file_original_name")
    .eq("lesson_id", lessonId);

  if (error) {
    console.error("[extract-files] db error:", error);
    return NextResponse.json({ error: "Failed to read materials" }, { status: 500 });
  }

  type Mat = { id: string; title: string; file_storage_path: string; file_original_name: string | null };
  const rows = (materials ?? []) as Mat[];

  const texts: Array<{ title: string; text: string; truncated: boolean }> = [];
  let totalChars = 0;

  for (const mat of rows) {
    if (totalChars >= MAX_TOTAL) break;
    const fileName = mat.file_original_name ?? mat.title ?? "";
    if (!isExtractable(fileName)) continue;

    try {
      const { data: fileData, error: dlErr } = await admin.storage
        .from("lesson-materials")
        .download(mat.file_storage_path);
      if (dlErr || !fileData) continue;

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const result = await extractText(buffer, mimeFromName(fileName), fileName);

      const remaining = MAX_TOTAL - totalChars;
      const textToAdd = result.text.slice(0, remaining);

      texts.push({
        title: mat.title || fileName || "Без названия",
        text: textToAdd,
        truncated: result.truncated || textToAdd.length < result.text.length,
      });
      totalChars += textToAdd.length;
    } catch (err) {
      console.warn(`[extract-files] skipping ${mat.file_storage_path}:`, err);
    }
  }

  return NextResponse.json({
    texts,
    totalChars,
    filesProcessed: texts.length,
    filesAttached: rows.length,
  });
}
