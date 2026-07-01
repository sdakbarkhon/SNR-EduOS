// How to render a shown material, by file extension — shared between the
// student demo overlay (LessonWorkspaceView) and the teacher's own demo
// preview (TeacherLessonDetailView).
export function demoKind(name: string): "pdf" | "video" | "image" | "other" {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["mp4", "webm", "ogg", "mov", "m4v"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  return "other";
}
