/**
 * Instant loading state for `/admin`.
 *
 * Composition mirrors `AdminPanel`: ink hero → Teams card (rows of team + members) → Sprint Gates
 * card → bug-report config card. Narrower main than the data pages, matching the real `max-w-5xl`.
 */
import { SkeletonChrome, SkeletonHero, SkeletonPanel, SkeletonRows } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <SkeletonChrome>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <SkeletonHero />
        <SkeletonPanel>
          <SkeletonRows rows={3} />
        </SkeletonPanel>
        <SkeletonPanel>
          <SkeletonRows rows={4} />
        </SkeletonPanel>
        <SkeletonPanel>
          <SkeletonRows rows={3} />
        </SkeletonPanel>
      </div>
    </SkeletonChrome>
  );
}
