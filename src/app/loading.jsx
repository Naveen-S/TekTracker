/**
 * Instant loading state for the board (`/`).
 *
 * The page is `force-dynamic` — every visit runs Prisma reads plus the pure metrics pass — so
 * without this file a navigation froze the previous screen with no acknowledgement until the RSC
 * payload landed. Route-level fallbacks are Next's own recommended fix (over `useLinkStatus`)
 * because they make the transition instant AND interruptible.
 *
 * The composition deliberately matches `Dashboard`: hero → KPI row → two-up trend/risk row →
 * sidebar + matrix.
 */
import {
  SkeletonChrome,
  SkeletonChart,
  SkeletonHero,
  SkeletonMatrix,
  SkeletonMetricGrid,
  SkeletonPanel,
  SkeletonRows,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonChrome>
      <SkeletonHero withBar />
      <SkeletonMetricGrid />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SkeletonChart />
        <SkeletonPanel>
          <SkeletonRows rows={4} />
        </SkeletonPanel>
      </section>
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[300px_1fr]">
        <SkeletonPanel className="hidden xl:block">
          <SkeletonRows rows={3} />
        </SkeletonPanel>
        <SkeletonMatrix />
      </section>
    </SkeletonChrome>
  );
}
