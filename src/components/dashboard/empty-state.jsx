"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * A rare, first-run screen (no teams, no tracks yet), so it gets the one small welcome the motion
 * budget allows: title, copy and action rise in 60ms apart (`animate-enter`; a fade under reduced
 * motion). Never blocks interaction — the button is clickable throughout.
 */
export function EmptyState({ title, body, actionLabel, actionHref, onAction }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-16 text-center">
      <h2 className="animate-enter text-lg font-semibold">{title}</h2>
      <p className="max-w-md animate-enter text-sm text-muted-foreground [animation-delay:60ms]">{body}</p>
      {actionLabel && actionHref && (
        <Button asChild className="mt-2 animate-enter [animation-delay:120ms]">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && (
        <Button className="mt-2 animate-enter [animation-delay:120ms]" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
