"use client";

/**
 * One scrum team's on-call card (support-oncall.md (f)): the Primary first, then the other POCs,
 * the modules (claimed sub-components) the team covers, the bug pulse "as on the board", and how
 * many of the cap are nominated. Edit appears only when the viewer manages the team.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PocContact } from "./poc-contact";

const MODULES_SHOWN = 4;

function Modules({ modules }) {
  const [expanded, setExpanded] = useState(false);
  if (modules.length === 0) return null;
  const shown = expanded ? modules : modules.slice(0, MODULES_SHOWN);
  const hidden = modules.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Modules covered">
      {shown.map((name) => (
        <li key={name} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground">
          {name}
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-accent"
          >
            +{hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}

function PulseCount({ label, count }) {
  return (
    <span className="whitespace-nowrap">
      {label}{" "}
      <span className={cn("font-semibold tabular-nums", count.open > 0 ? "text-danger-strong" : "text-foreground")}>
        {count.open} open
      </span>
      <span className="text-muted-foreground tabular-nums"> / {count.total}</span>
    </span>
  );
}

function BugPulse({ pulse, href }) {
  if (!pulse) {
    return <p className="text-xs text-muted-foreground">No bug tracks on the board for this sprint.</p>;
  }
  return (
    <Link
      href={href}
      className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md text-xs text-secondary-foreground hover:text-foreground"
      title="Open bugs as on the board — opens the team's board"
    >
      <PulseCount label="External bugs" count={pulse.external} />
      <span className="text-border" aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <PulseCount label="Internal bugs" count={pulse.internal} />
        <ArrowUpRight
          className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export function TeamCard({ team, sprint, highlighted, onEdit }) {
  const primary = team.pocs.find((poc) => poc.isPrimary) ?? null;
  const others = team.pocs.filter((poc) => !poc.isPrimary);

  return (
    <article
      id={`team-${team.id}`}
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-xl border bg-card p-4 transition-shadow duration-500 sm:p-5",
        highlighted && "ring-2 ring-primary shadow-brand",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-mono text-[11px] font-semibold text-accent-foreground">{team.key}</span>
            <span className="truncate font-display text-base font-bold">{team.name}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {team.pocs.length} of {team.cap} nominated
          </p>
        </div>
        {team.canEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(team)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        )}
      </header>

      {team.pocs.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No POCs nominated for {sprint.name}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {primary && <PocContact poc={primary} primary />}
          {others.map((poc) => (
            <PocContact key={poc.email} poc={poc} />
          ))}
        </div>
      )}

      <Modules modules={team.modules} />

      <footer className="mt-auto border-t pt-3">
        <BugPulse pulse={team.pulse} href={`/?team=${team.id}&sprint=${sprint.id}`} />
      </footer>
    </article>
  );
}
