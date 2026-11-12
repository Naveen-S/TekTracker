"use client";

/**
 * Who is carrying the open work (sow-tracker.md round 2): one thin bar per person, planned
 * tickets and issues (bugs plus pre-QA Slack issues that mention them) as two segments with a
 * surface gap, the total at the tip. "Unassigned" is pinned first: unowned work is the finding.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

const SHOWN = 6;

export function PeopleLoad({ people, onOpenPerson }) {
  const [expanded, setExpanded] = useState(false);
  if (people.length === 0) return <p className="py-2 text-sm text-muted-foreground">No open work.</p>;
  const peak = Math.max(...people.map((person) => person.total));
  const shown = expanded ? people : people.slice(0, SHOWN);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="flex flex-col gap-2">
        {shown.map((person) => {
          const issues = person.bugs + person.slack;
          const unassigned = person.name === "Unassigned";
          return (
            <li key={person.name}>
              <button
                type="button"
                onClick={() => onOpenPerson(person.name)}
                className="group grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-2 rounded text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                title={`${person.name}: ${person.planned} planned, ${person.bugs} bugs, ${person.slack} pre-QA issues`}
              >
                <span className={cn("truncate text-xs font-medium group-hover:text-primary", unassigned && "font-bold text-warn-strong")}>{person.name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-3 gap-0.5" style={{ width: `${Math.max((person.total / peak) * 82, 4)}%` }}>
                    {person.planned > 0 && <span className={cn("h-full rounded-r-[3px]", unassigned ? "bg-warn" : "bg-primary")} style={{ flexGrow: person.planned }} />}
                    {issues > 0 && <span className="h-full rounded-r-[3px] bg-danger" style={{ flexGrow: issues }} />}
                  </span>
                  <span className="text-xs font-bold tabular-nums">{person.total}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {people.length > SHOWN && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-2 self-start rounded-md px-1.5 py-1 text-xs font-medium text-primary hover:bg-accent">
          {expanded ? "Show fewer" : `${people.length - SHOWN} more people`}
        </button>
      )}
      <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-primary" />Planned tickets</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-danger" />Issues</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-warn" />Unassigned</span>
      </p>
    </div>
  );
}
