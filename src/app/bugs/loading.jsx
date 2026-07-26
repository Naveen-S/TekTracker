/**
 * Instant loading state for the bug-report dashboard (`/bugs`, shared by `/bugs/[slug]`).
 *
 * Composition mirrors `BugsPage`: hero with the pressure rail → 5 KPI cards (lead card spans two
 * columns) → the wide matrix → two-up trend/SLA row → three-up mix row.
 */
import {
  SkeletonChrome,
  Skeleton,
  SkeletonChart,
  SkeletonHero,
  SkeletonPanel,
  SkeletonRows,
} from "@/components/ui/skeleton";

export default function BugsLoading() {
  return (
    <SkeletonChrome>
      <SkeletonHero withBar />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <article className="relative col-span-2 overflow-hidden rounded-lg border bg-card p-4 pt-4.5">
          <span className="absolute inset-x-0 top-0 h-0.75 bg-muted" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="mt-3.5 h-9 w-32" />
          <Skeleton className="mt-2.5 h-2.5 w-36" />
        </article>
        {Array.from({ length: 4 }, (_, index) => (
          <article key={index} className="relative overflow-hidden rounded-lg border bg-card p-4 pt-4.5">
            <span className="absolute inset-x-0 top-0 h-0.75 bg-muted" />
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="mt-3.5 h-6 w-20" />
            <Skeleton className="mt-2.5 h-2.5 w-24" />
          </article>
        ))}
      </section>

      {/* The matrix: a frozen first column plus ~13 scope × band columns. */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="flex items-center gap-2 bg-muted/40 px-4 py-2.5">
          <Skeleton className="h-2.5 w-40 shrink-0" />
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} className="hidden h-2.5 flex-1 lg:block" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} className="flex items-center gap-2 border-t border-border-subtle px-4 py-2.5">
            <Skeleton className="h-3 w-40 shrink-0" />
            {Array.from({ length: 12 }, (_, cell) => (
              <Skeleton key={cell} className="hidden h-4 flex-1 lg:block" />
            ))}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SkeletonChart />
        <SkeletonPanel>
          <SkeletonRows rows={4} />
        </SkeletonPanel>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((panel) => (
          <SkeletonPanel key={panel}>
            <SkeletonRows rows={4} />
          </SkeletonPanel>
        ))}
      </section>
    </SkeletonChrome>
  );
}
