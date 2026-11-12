"use client";

/**
 * The /sow list (sow-tracker.md (g)): one card per SOW — its timeline, the weighted
 * %, days to launch and health — grouped by program. Admins create a SOW here, from the standard
 * template or as a copy of an existing one (decision 9).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { Toast, useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";
import { SOW_STATUS_LABELS } from "@/lib/sow/defaults.mjs";
import { formatDay } from "@/lib/sow/timeline.mjs";
import { TimelineChart } from "./timeline-chart";
import { HealthChip, ProgressBar, pctLabel } from "./sow-kit";
import { SowFormDialog } from "./sow-form-dialog";

const NO_PROGRAM = "none";

/** Cards grouped by program (alphabetical), unassigned last. */
function groupByProgram(cards) {
  const groups = new Map();
  for (const card of cards) {
    const id = card.sow.program?.id ?? NO_PROGRAM;
    if (!groups.has(id)) groups.set(id, { id, name: card.sow.program?.name ?? "No program", cards: [] });
    groups.get(id).cards.push(card);
  }
  return [...groups.values()].sort((a, b) => (a.id === NO_PROGRAM ? 1 : b.id === NO_PROGRAM ? -1 : a.name.localeCompare(b.name)));
}

function launchLine(launch) {
  if (launch.daysLeft > 0) return `${launch.daysLeft} ${launch.daysLeft === 1 ? "day" : "days"} to ${launch.title}`;
  return launch.daysLeft === 0 ? `${launch.title} is today` : `${launch.title} was ${Math.abs(launch.daysLeft)} days ago`;
}

function SowCard({ card }) {
  const { sow, progress, health, launch } = card;
  return (
    <article className={cn("group relative flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md sm:p-5", sow.status !== "ACTIVE" && "opacity-75")}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight font-bold">
            <Link href={`/sow/${sow.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
              {sow.name}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {launchLine(launch)} · {formatDay(launch.date, { year: true })}
            {launch.slip > 0 && <span className="font-semibold text-warn-strong"> · slipped +{launch.slip} d</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sow.status !== "ACTIVE" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">{SOW_STATUS_LABELS[sow.status]}</span>}
          <HealthChip health={health} />
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-px group-hover:-translate-y-px" aria-hidden="true" />
        </div>
      </header>

      <div className="flex items-center gap-3">
        <ProgressBar pct={progress.overall.pct} expectedPct={health.expectedPct} className="flex-1" />
        <span className="w-11 text-right font-display text-lg font-extrabold tabular-nums">{pctLabel(progress.overall.pct)}</span>
      </div>

      <div className="relative z-10"><TimelineChart timeline={card.timeline} phases={card.phases} today={card.today} compact /></div>

      <footer className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground tabular-nums">
        <span>
          <span className="font-semibold text-foreground">{progress.overall.done}</span> of {progress.overall.total} tickets done
        </span>
        <span>
          <span className={cn("font-semibold", progress.bugs.open > 0 ? "text-danger-strong" : "text-foreground")}>{progress.bugs.open}</span> open bugs
        </span>
        <span>
          <span className="font-semibold text-foreground">{card.openRisks}</span> open risks
        </span>
        {card.funnel[0].tracked && (
          <span>
            <span className={cn("font-semibold", card.funnel[0].open > 0 ? "text-danger-strong" : "text-foreground")}>{card.funnel[0].open}</span> open pre-QA issues
          </span>
        )}
        {!card.hasData && <span className="font-medium text-warn-strong">Not refreshed from Jira yet</span>}
      </footer>
    </article>
  );
}

export function SowList({ cards, programs, canEdit }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [toast, showToast] = useToast();
  const groups = groupByProgram(cards);
  const active = cards.filter((card) => card.sow.status === "ACTIVE").length;

  return (
    <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
      <HeroShell className="flex flex-col gap-5 px-5 py-6 md:px-8 md:py-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <HeroEyebrow>SOW tracker</HeroEyebrow>
          <HeroTitle>SOWs & program projects</HeroTitle>
          <HeroCopy className="mt-2 max-w-2xl">
            Fixed-timeline work that sits outside the scrum boards: every phase from set-up to launch, with its epics, stories, RELB tickets, bugs and UAT issues in one place.
            {cards.length > 0 && <span className="font-semibold text-on-hero"> {active} active.</span>}
          </HeroCopy>
        </div>
        {canEdit && (
          <Button variant="onDark" className="self-start sm:self-auto" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New SOW
          </Button>
        )}
      </HeroShell>

      {cards.length === 0 ? (
        <EmptyState
          title="No SOWs yet"
          body={canEdit ? "Create one from the standard template: give it a Jira filter, a start date and a launch date." : "An admin can create the first SOW here."}
          actionLabel={canEdit ? "New SOW" : undefined}
          onAction={canEdit ? () => setCreating(true) : undefined}
        />
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`sow-program-${group.id}`} className="flex flex-col gap-3">
            <h2 id={`sow-program-${group.id}`} className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              <Layers className={cn("size-3.5", group.id !== NO_PROGRAM && "text-primary")} aria-hidden="true" />
              {group.name}
              <span className="font-medium tracking-normal normal-case tabular-nums">
                · {group.cards.length} {group.cards.length === 1 ? "SOW" : "SOWs"}
              </span>
            </h2>
            <div className="grid gap-4 *:min-w-0 xl:grid-cols-2">
              {group.cards.map((card) => (
                <SowCard key={card.sow.id} card={card} />
              ))}
            </div>
          </section>
        ))
      )}

      {creating && (
        <SowFormDialog
          mode="create"
          programs={programs}
          sows={cards.map((card) => card.sow)}
          onClose={() => setCreating(false)}
          onSaved={(saved, message) => {
            setCreating(false);
            showToast(message);
            router.push(`/sow/${saved.slug}`);
          }}
        />
      )}
      <Toast toast={toast} />
    </main>
  );
}
