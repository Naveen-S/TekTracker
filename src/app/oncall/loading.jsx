/**
 * Instant loading state for /oncall: the hero, a program heading and a grid of team cards, on the
 * same shimmer primitives as every other route.
 */
import { SkeletonChrome, Skeleton, SkeletonHero } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-2.5 w-24" />
        </div>
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-3 w-56" />
    </section>
  );
}

export default function OnCallLoading() {
  return (
    <SkeletonChrome>
      <>
        <SkeletonHero />
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <CardSkeleton key={card} />
          ))}
        </div>
      </>
    </SkeletonChrome>
  );
}
