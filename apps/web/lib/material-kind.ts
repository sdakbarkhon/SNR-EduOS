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

export function demoKind(name: string, url?: string | null): "pdf" | "video" | "image" | "office" | "other" {
  const exts = [extOf(name)];
  if (url) {
    try {
      exts.push(extOf(new URL(url).pathname));
    } catch { /* not an absolute URL — ignore */ }
  }
  if (exts.includes("pdf")) return "pdf";
  if (exts.some((e) => ["mp4", "webm", "ogg", "mov", "m4v"].includes(e))) return "video";
  if (exts.some((e) => ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(e))) return "image";
  // Same extension set as FileViewerModal.tsx's OFFICE_EXTS — rendered via
  // the same Microsoft Office Online Viewer iframe there; this file previously
  // had no "office" case at all, so any .pptx/.docx demoed live fell into
  // "other" and showed "формат не поддерживается" for BOTH the teacher's own
  // preview and the students' broadcast (they share this classifier).
  if (exts.some((e) => ["pptx", "docx", "ppt", "doc", "xlsx", "xls"].includes(e))) return "office";
  return "other";
}
