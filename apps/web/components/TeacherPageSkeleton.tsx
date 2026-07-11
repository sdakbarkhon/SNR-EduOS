/** Промт "презентации/skeleton", Задача 3: generic content-area skeleton for
 *  teacher route loading.tsx files. Next.js shows this immediately on
 *  navigation (via the automatic Suspense boundary loading.tsx creates)
 *  while the target page's Server Component awaits its data — the sidebar/
 *  topbar (rendered by the persistent teacher/layout.tsx) stay mounted and
 *  interactive the whole time, only the content area below shows this. */
export function TeacherPageSkeleton({ variant = "list" }: { variant?: "list" | "cards" | "detail" }) {
  if (variant === "cards") {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-40 rounded-2xl bg-slate-100" />
          <div className="h-40 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-[50vh] min-h-[360px] rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-64 rounded-xl bg-slate-100" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}
