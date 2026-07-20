"use client";

import { Download, Layers, Link2, ListChecks, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DaysRemainingPill,
  HeroCopy,
  HeroEyebrow,
  HeroShell,
  HeroTitle,
} from "@/components/ui/hero-shell";
import { formatDate, getDaysRemaining } from "@/lib/metrics.mjs";

const WELCOME_FEATURES = [
  { icon: Layers, label: "Multiple Jira filters", detail: "Roadmap, support, tech debt — one board" },
  { icon: ListChecks, label: "Stage-by-stage tracking", detail: "The full SDLC beyond Jira status" },
  { icon: TrendingUp, label: "Leadership-ready metrics", detail: "Health, velocity, and risk at a glance" },
];

export function Hero({
  showWelcome,
  sprint,
  team,
  density,
  onToggleDensity,
  onConfigureSprint,
  onAddFilter,
  onShare,
  onExport,
  onAiDigest,
}) {
  if (showWelcome) {
    return (
      <HeroShell className="flex min-h-80 flex-col items-center justify-center gap-4 px-5 py-10 text-center md:px-8 md:py-12">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
          {team.name} · {sprint.name} · {formatDate(sprint.developmentStart)} –{" "}
          {formatDate(sprint.developmentEnd)}
        </span>
        <HeroTitle className="mt-0">Sprint Tracker</HeroTitle>
        <HeroCopy className="max-w-md">
          Track delivery progress across multiple Jira filters with real-time visibility
        </HeroCopy>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {onAddFilter ? (
            <Button onClick={onAddFilter}>+ Add Jira Filter to Get Started</Button>
          ) : (
            <HeroCopy>A team Lead/EM adds the Jira filters — nothing here yet.</HeroCopy>
          )}
          {onConfigureSprint && (
            <Button variant="onDark" onClick={onConfigureSprint}>
              Configure Sprint
            </Button>
          )}
        </div>
        <div className="mt-4 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {WELCOME_FEATURES.map(({ icon: Icon, label, detail }) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-white/5 p-3 text-left backdrop-blur-sm"
            >
              <Icon className="size-4 text-on-ink-accent" aria-hidden="true" />
              <p className="mt-1.5 text-[13px] font-semibold text-white">{label}</p>
              <p className="mt-0.5 text-xs text-white/60">{detail}</p>
            </div>
          ))}
        </div>
      </HeroShell>
    );
  }

  const daysRemaining = getDaysRemaining(sprint);
  return (
    <HeroShell className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8 md:py-7">
      <div>
        <HeroEyebrow>
          {sprint.name} · {formatDate(sprint.developmentStart)} – {formatDate(sprint.developmentEnd)}
          {sprint.releaseDate ? ` · release ${formatDate(sprint.releaseDate)}` : ""}
        </HeroEyebrow>
        <HeroTitle>{team.name} — sprint delivery board</HeroTitle>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <HeroCopy>
            Roadmap, support, and tech-debt tracks with stage-by-stage delivery visibility.
          </HeroCopy>
          <DaysRemainingPill days={daysRemaining} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="onDark" size="sm" onClick={onToggleDensity}>
          {density === "dense" ? "Relaxed view" : "Dense view"}
        </Button>
        {onAiDigest && (
          <Button variant="onDark" size="sm" onClick={onAiDigest}>
            <Sparkles /> AI Digest
          </Button>
        )}
        {onShare && (
          <Button variant="onDark" size="sm" onClick={onShare}>
            <Link2 /> Share View
          </Button>
        )}
        {onExport && (
          <Button variant="onDark" size="sm" onClick={onExport}>
            <Download /> Export
          </Button>
        )}
        {onConfigureSprint && (
          <Button variant="onDark" size="sm" onClick={onConfigureSprint}>
            Configure Sprint
          </Button>
        )}
      </div>
    </HeroShell>
  );
}
