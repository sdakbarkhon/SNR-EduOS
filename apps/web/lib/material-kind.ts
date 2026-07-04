// How to render a shown material, by file extension — shared between the
// student demo overlay (LessonWorkspaceView) and the teacher's own demo
// preview (TeacherLessonDetailView).
//
// Checks both the display name (file_original_name, falling back to the
// teacher-entered title) AND the resolved signed URL's path. The name alone
// isn't reliable — the title fallback often has no file extension at all —
// so a genuine PDF could be classified as "other" and rejected as "not a PDF"
// even though the storage object itself is a real PDF (Iter5 hotfix P14.2).
function extOf(s: string): string {
  return (s.split(".").pop() ?? "").toLowerCase();
}

export function demoKind(name: string, url?: string | null): "pdf" | "video" | "image" | "other" {
  const exts = [extOf(name)];
  if (url) {
    try {
      exts.push(extOf(new URL(url).pathname));
    } catch { /* not an absolute URL — ignore */ }
  }
  if (exts.includes("pdf")) return "pdf";
  if (exts.some((e) => ["mp4", "webm", "ogg", "mov", "m4v"].includes(e))) return "video";
  if (exts.some((e) => ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(e))) return "image";
  return "other";
}
