/** Generic pulse skeleton shown by section-level loading.tsx while the RSC
 *  data fetch for that route resolves — replaces the frozen/blank screen. */
export function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-white/70" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-28 rounded-2xl bg-white/70 md:col-span-2" />
        <div className="h-28 rounded-2xl bg-white/70" />
      </div>
      <div className="h-40 rounded-2xl bg-white/70" />
      <div className="h-40 rounded-2xl bg-white/70" />
    </div>
  );
}
