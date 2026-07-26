"use client";

/**
 * A nav `<Link>` that acknowledges the click.
 *
 * Every authenticated page here is `force-dynamic` — an auth gate plus Prisma reads plus a metrics
 * pass — so cross-page navigation is genuinely slow, and it used to be completely silent: the old
 * screen simply sat there until the RSC payload arrived.
 *
 * The route-level `loading.jsx` skeletons are the structural fix and Next prefers them over this
 * hook, but they only take over once the router commits the transition. Measured against a running
 * server with the RSC request delayed, the old page stays on screen for that whole window. So the
 * click also needs an acknowledgement that does not depend on the router committing anything —
 * which is precisely the case the `useLinkStatus` docs name: a dynamic destination whose fallback
 * cannot be served instantly.
 *
 * Two indicators, one motion idea (the travelling highlight already used by `ProgressBar`):
 *  - a global 2px top bar, the conventional "the app is fetching a page" signal;
 *  - a local sweep under the clicked item, so it is obvious *which* destination is loading.
 *
 * Both are absolutely/fixed positioned, so neither can shift layout — including the Modern
 * sidebar's collapsed icon-rail, where there is no room for a trailing element. Both fade in on a
 * 150ms delay: a navigation faster than that shows nothing, because a one-frame flicker reads as a
 * glitch rather than as feedback. Only one link can be pending at a time, so hosting the global
 * bar inside the link is safe and needs no provider.
 */
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

function PendingIndicator({ className }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-70 h-[3px] overflow-hidden bg-primary/15 opacity-0 transition-opacity duration-200 delay-150",
          pending && "opacity-100",
        )}
      >
        <span className={cn("progress-sweep block h-full w-1/5 rounded-full bg-primary shadow-brand", pending && "animate-progress")} />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full opacity-0 transition-opacity duration-200 delay-150",
          pending && "opacity-100",
          className,
        )}
      >
        <span className={cn("progress-sweep block h-full w-1/3 rounded-full bg-current", pending && "animate-progress")} />
      </span>
    </>
  );
}

export function NavLink({ href, className, sweepClassName, children, ...props }) {
  return (
    <Link href={href} className={cn("relative", className)} {...props}>
      {children}
      <PendingIndicator className={sweepClassName} />
    </Link>
  );
}
