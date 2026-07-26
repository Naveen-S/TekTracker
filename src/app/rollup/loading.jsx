/**
 * Instant loading state for the multi-team roll-up (`/rollup`).
 *
 * This is the slowest route in the app to arrive — it fans out batched reads across every team the
 * caller belongs to and runs `computeSprintMetrics` per team before aggregating — so it is the one
 * that most needed a fallback. Composition mirrors the real page: hero → combined KPI row →
 * trend/risk row → per-team summary table.
 */
import {
  SkeletonChrome,
  SkeletonChart,
  SkeletonHero,
  SkeletonMetricGrid,
  SkeletonPanel,
  SkeletonRows,
} from "@/components/ui/skeleton";

export default function RollupLoading() {
  return (
    <SkeletonChrome>
      <SkeletonHero />
      <SkeletonMetricGrid />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SkeletonChart />
        <SkeletonPanel>
          <SkeletonRows rows={4} />
        </SkeletonPanel>
      </section>
      <SkeletonPanel>
        <SkeletonRows rows={6} />
      </SkeletonPanel>
    </SkeletonChrome>
  );
}
