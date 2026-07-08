"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, getDaysRemaining } from "@/lib/metrics.mjs";

export function Hero({
  showWelcome,
  sprint,
  team,
  density,
  onToggleDensity,
  onConfigureSprint,
  onAddFilter,
}) {
  if (showWelcome) {
    return (
      <section className="rounded-xl border bg-gradient-to-br from-[#0b1620] to-[#15303f] p-10 text-center text-white">
        <h1 className="text-2xl font-semibold">Sprint Tracker</h1>
        <p className="mt-2 text-sm text-white/70">
          Track delivery progress across multiple Jira filters with real-time visibility
        </p>
        <p className="mt-4 text-xs text-white/60">
          {team.name} · {sprint.name} · {formatDate(sprint.developmentStart)} –{" "}
          {formatDate(sprint.developmentEnd)}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onAddFilter ? (
            <Button onClick={onAddFilter}>+ Add Jira Filter to Get Started</Button>
          ) : (
            <p className="text-sm text-white/70">
              A team Lead/EM adds the Jira filters — nothing here yet.
            </p>
          )}
          {onConfigureSprint && (
            <Button
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={onConfigureSprint}
            >
              Configure Sprint
            </Button>
          )}
        </div>
      </section>
    );
  }

  const daysRemaining = getDaysRemaining(sprint);
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-br from-[#0b1620] to-[#15303f] px-6 py-5 text-white">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/60">
          {sprint.name} · {formatDate(sprint.developmentStart)} – {formatDate(sprint.developmentEnd)}
          {sprint.releaseDate ? ` · release ${formatDate(sprint.releaseDate)}` : ""}
        </p>
        <h1 className="mt-1 text-xl font-semibold">
          {team.name} — sprint delivery board
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-white/75">
          <span>Roadmap, support, and tech-debt tracks with stage-by-stage delivery visibility.</span>
          <Badge tone={daysRemaining < 3 ? "danger" : "info"}>
            {daysRemaining > 0
              ? `${daysRemaining} days remaining`
              : daysRemaining === 0
                ? "Last day!"
                : "Sprint ended"}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={onToggleDensity}
        >
          {density === "dense" ? "Relaxed view" : "Dense view"}
        </Button>
        {onConfigureSprint && (
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={onConfigureSprint}
          >
            Configure Sprint
          </Button>
        )}
      </div>
    </section>
  );
}
