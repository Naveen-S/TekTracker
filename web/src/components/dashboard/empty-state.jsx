"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, body, actionLabel, actionHref, onAction }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {actionLabel && actionHref && (
        <Button asChild className="mt-2">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && (
        <Button className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
