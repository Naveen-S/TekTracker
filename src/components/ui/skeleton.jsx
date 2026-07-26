/**
 * Skeleton vocabulary for route-level loading states (`app/**\/loading.jsx`).
 *
 * Server-safe on purpose — `loading.jsx` renders on the server and must not pull a client
 * boundary in just to draw placeholders.
 *
 * Two rules the pieces below exist to enforce:
 *  1. A skeleton mirrors the REAL composition of the page it stands in for. A generic centred
 *     spinner tells the user "wait"; a skeleton that already has the hero, the five KPI cards and
 *     the two-up panel row in the right places tells them "this is your board, filling in" — so
 *     the swap to real content reads as completion, not replacement.
 *  2. It sweeps, it doesn't blink. A travelling highlight matches how content actually streams;
 *     an opacity pulse just flashes boxes. Transform-only, so it stays off the main thread while
 *     React is busy hydrating the incoming RSC payload.
 */
import { cn } from "@/lib/utils";

/**
 * One placeholder block. `bg-muted` keeps it inside the token system in both themes; the sweep is
 * an absolutely-positioned gradient child so the animation never touches layout.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-muted/70", className)}
      aria-hidden="true"
      {...props}
    >
      <span className="skeleton-sweep absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/55 to-transparent" />
    </div>
  );
}

/** Skeleton on the ink hero — the sweep has to read against a dark surface, not a light one. */
function InkSkeleton({ className }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-white/12", className)} aria-hidden="true">
      <span className="skeleton-sweep absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/18 to-transparent" />
    </div>
  );
}

/**
 * The app chrome, held steady through the transition.
 *
 * `AppShell` lives inside each page rather than a shared layout, so a route-level `loading.jsx`
 * replaces the sidebar and top bar too. Redrawing them as skeletons keeps the frame visually
 * continuous instead of collapsing the whole window to blank on every navigation. The sidebar rail
 * uses the same `lg:flex` CSS-reveal as the real one (both themes).
 */
export function SkeletonChrome({ children }) {
  return (
    <div className="app-shell flex min-h-screen" role="status" aria-busy="true" aria-label="Loading page">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink lg:flex">
        <div className="flex h-14 items-center gap-2.5 px-3.5">
          <div className="size-8 shrink-0 rounded-lg bg-primary/60" />
          <InkSkeleton className="h-3.5 w-28" />
        </div>
        <div className="mt-2 flex flex-col gap-1 px-2.5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-lg px-2.5 py-2">
              <InkSkeleton className="size-[18px] rounded" />
              <InkSkeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </aside>

      <div className="app-main flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-2 md:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5.5 w-23" />
            <span className="hidden h-5.5 w-px bg-border sm:block" />
            <Skeleton className="hidden h-8 w-32 sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">{children}</main>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * The ink hero, rendered as a real hero rather than a grey rectangle — it is the one element whose
 * surface we know before the data lands, so drawing it in full makes the page feel already-arrived.
 */
export function SkeletonHero({ lines = 2, withBar = false }) {
  return (
    <section className="hero-panel relative overflow-hidden rounded-2xl px-5 py-5 text-white md:px-7 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <InkSkeleton className="h-2.5 w-40" />
          <InkSkeleton className="mt-2.5 h-7 w-72 max-w-full" />
          {lines > 1 && <InkSkeleton className="mt-3 h-3 w-96 max-w-full" />}
        </div>
        <InkSkeleton className="size-20 shrink-0 rounded-full" />
      </div>
      {withBar && (
        <div className="mt-6 flex items-end gap-1.5">
          {[38, 22, 30, 18, 26, 20, 24].map((width, index) => (
            <InkSkeleton key={index} className="h-8 flex-1 rounded-lg" style={{ flexGrow: width }} />
          ))}
        </div>
      )}
    </section>
  );
}

/** The five-up KPI row — same responsive steps as the real `MetricGrid`. */
export function SkeletonMetricGrid({ count = 5 }) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <article key={index} className="relative overflow-hidden rounded-lg border bg-card p-4 pt-4.5">
          <span className="absolute inset-x-0 top-0 h-0.75 bg-muted" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="mt-3.5 h-6 w-24" />
          <Skeleton className="mt-2.5 h-2.5 w-32" />
        </article>
      ))}
    </section>
  );
}

/** A titled card placeholder — the shape every panel on the app shares. */
export function SkeletonPanel({ className, children }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-3 w-32" />
      </div>
      {children}
    </section>
  );
}

/** Chart panels: a plot area with a plausible baseline, so the card isn't one flat slab. */
export function SkeletonChart({ className }) {
  return (
    <SkeletonPanel className={className}>
      <Skeleton className="mt-4 h-40 w-full rounded-lg" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
    </SkeletonPanel>
  );
}

/** Repeated rows — the risk list, the team table, the issue matrix. */
export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cn("mt-3 flex flex-col", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-t border-border-subtle py-2.5 first:border-t-0"
        >
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${68 - index * 6}%` }} />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/** The Delivery Matrix — a frozen first column plus a stage grid, its most recognisable shape. */
export function SkeletonMatrix({ rows = 6 }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex items-center gap-3 bg-muted/40 px-4 py-2.5">
        <Skeleton className="h-2.5 w-44 shrink-0" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="hidden h-2.5 flex-1 lg:block" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5">
          <div className="flex w-44 shrink-0 items-center gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 flex-1" />
          </div>
          {Array.from({ length: 7 }, (_, cell) => (
            <Skeleton key={cell} className="hidden h-6 flex-1 rounded-md lg:block" />
          ))}
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </section>
  );
}
