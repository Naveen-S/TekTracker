/**
 * Instant loading state for /sow and /sow/[slug]: the hero, the journey strip and a few panels,
 * on the same shimmer primitives as every other route.
 */
import { SkeletonChrome, Skeleton, SkeletonHero, SkeletonPanel, SkeletonRows } from "@/components/ui/skeleton";

export default function SowLoading() {
  return (
    <SkeletonChrome>
      <>
        <SkeletonHero withBar />
        <section className="rounded-xl border bg-card p-5">
          <div className="grid grid-cols-4 gap-4 md:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((node) => (
              <div key={node} className={node > 3 ? "hidden md:block" : undefined}>
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="mt-2 h-3 w-20" />
                <Skeleton className="mt-1.5 h-2.5 w-16" />
              </div>
            ))}
          </div>
        </section>
        <SkeletonPanel>
          <SkeletonRows rows={4} />
        </SkeletonPanel>
        <div className="grid gap-4 xl:grid-cols-2">
          <SkeletonPanel>
            <SkeletonRows rows={4} />
          </SkeletonPanel>
          <SkeletonPanel>
            <SkeletonRows rows={4} />
          </SkeletonPanel>
        </div>
      </>
    </SkeletonChrome>
  );
}
