/**
 * Instant loading state for /security in its DEFAULT StoryBoard look (look.jsx): the ink hero, then
 * progress + Path to zero (two-up on wide screens), the KPI row and a panel. Same shimmer primitives
 * as every other route. (A browser that chose the Artifact look switches once the page hydrates.)
 */
import { SkeletonChrome, Skeleton, SkeletonChart, SkeletonHero, SkeletonRows } from "@/components/ui/skeleton";

function Card({ className = "", children }) {
  return <section className={`min-w-0 rounded-xl border bg-card p-5 ${className}`}>{children}</section>;
}

function CardTitle({ width = "w-48" }) {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-5 rounded-md" />
      <Skeleton className={`h-3.5 ${width}`} />
      <Skeleton className="h-4 w-10 rounded-full" />
    </div>
  );
}

export default function SecurityLoading() {
  return (
    <SkeletonChrome>
      <>
        <SkeletonHero />

        <div className="grid gap-4 2xl:grid-cols-2">
          <Card>
            <CardTitle />
            <Skeleton className="mt-4 h-7 w-full rounded-full" />
            <SkeletonChart className="mt-4" />
          </Card>
          <Card className="hidden 2xl:block">
            <CardTitle width="w-28" />
            <Skeleton className="mt-4 h-28 w-full rounded-2xl" />
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((tile) => (
                <Skeleton key={tile} className="h-16 rounded-xl" />
              ))}
            </div>
          </Card>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
          {Array.from({ length: 8 }, (_, index) => (
            <article key={index} className="rounded-xl border bg-card px-4 pt-4 pb-3.5">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="mt-2 h-2.5 w-24" />
            </article>
          ))}
        </section>

        <Card>
          <CardTitle width="w-64" />
          <Skeleton className="mt-4 h-8 w-full rounded-full" />
          <SkeletonRows rows={2} />
        </Card>
      </>
    </SkeletonChrome>
  );
}
