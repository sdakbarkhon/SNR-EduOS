import { TeacherPageSkeleton } from "@/components/TeacherPageSkeleton";

/** General fallback for any /teacher/* route without its own more specific
 *  loading.tsx — Next.js picks the closest one in the tree. Without this,
 *  the whole content area stayed blank/frozen for as long as the target
 *  page's Server Component took to resolve its data (no streaming at all). */
export default function Loading() {
  return <TeacherPageSkeleton variant="list" />;
}
