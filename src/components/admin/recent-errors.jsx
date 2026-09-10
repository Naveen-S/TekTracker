"use client";

/**
 * Admin → Recent errors (observability-and-errors.md pillar 5).
 *
 * Production runs on internal Tekion infra where reading the container's stdout is a ticket, not a
 * command — so the last server-side failures are surfaced in the app itself. Rows are written by
 * `lib/error-log.js` for status >= 500 only, so this is a list of incidents, not of traffic.
 *
 * Each row carries the same `requestId` the user saw in their error dialog, which is what closes
 * the loop between "sync failed, ref r7k2q9xf" and the stack that caused it.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

const CODE_TONE = {
  JIRA_AUTH: "bg-warn-soft text-warn-strong",
  JIRA_API: "bg-warn-soft text-warn-strong",
  JIRA_UNREACHABLE: "bg-danger-soft text-danger-strong",
  JIRA_TIMEOUT: "bg-danger-soft text-danger-strong",
  DB_UNAVAILABLE: "bg-danger-soft text-danger-strong",
  DB_MIGRATION_MISSING: "bg-danger-soft text-danger-strong",
  CONFIG_MISSING: "bg-danger-soft text-danger-strong",
  SESSION_WRITE_FAILED: "bg-danger-soft text-danger-strong",
};

function formatWhen(value) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ErrorRow({ row }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(row.details || row.stack);

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((value) => !value)}
        className={cn(
          "flex w-full items-start gap-3 px-1 py-2.5 text-left",
          hasDetail && "cursor-pointer hover:bg-muted/40",
        )}
        aria-expanded={hasDetail ? open : undefined}
      >
        <span className="w-28 shrink-0 pt-0.5 text-[11px] text-muted-foreground tabular-nums">
          {formatWhen(row.createdAt)}
        </span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
            CODE_TONE[row.code] ?? "bg-muted text-secondary-foreground",
          )}
        >
          {row.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground">{row.message}</span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
            {row.status} · {row.source}
            {row.route ? ` · ${row.route}` : ""} · {row.requestId}
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-1 pb-3 pl-[7.75rem]">
          {row.details && (
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2.5 font-mono text-[11px] whitespace-pre-wrap text-secondary-foreground">
              {JSON.stringify(row.details, null, 2)}
            </pre>
          )}
          {row.stack && (
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2.5 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
              {row.stack}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

export function RecentErrors({ errors = [] }) {
  if (errors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        No server errors recorded in the last 14 days.
      </p>
    );
  }

  return (
    <ul className="-my-1">
      {errors.map((row) => (
        <ErrorRow key={row.id} row={row} />
      ))}
    </ul>
  );
}
