"use client";

/**
 * App navigation sidebar (modern-theme.md Phase B; promoted to both themes per Naveen 2026-07-26).
 * Rendered by AppShell on the four authenticated pages, visible at lg+ widths in BOTH themes
 * (`hidden lg:flex`) and hidden below lg so mobile falls back to top-bar nav. `bg-ink` plus the
 * themed `--primary`/`--accent` tokens mean it re-hues automatically: an ink rail with a teal active
 * state under Tekion; under Modern the `.app-sidebar` scope in globals.css turns it white with the
 * gradient active item (modern-artifact-theme.md, decision 6 amended), and the `modern:` classes
 * below keep its labels legible there.
 *
 * Nav owns the cross-page links at lg+ (the top bars hide theirs via `lg:hidden`).
 * Collapse ↔ icon-rail state is a third ephemeral localStorage pref (§17).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLines,
  Bug,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Milestone,
  PanelLeft,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  SquareTerminal,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, Wordmark } from "./brand";
import { NavLink } from "./nav-link";
import { useLocalPref } from "@/lib/use-local-pref";
import { useConnectorStatus } from "@/lib/use-connector-status";

const COLLAPSE_KEY = "sprintTracker_sidebarCollapsed";

/** Claude Code connection states (lib/use-connector-status): wording + whether it needs attention. */
const CONNECTION = {
  connected: { label: "Connected", dot: "bg-success", attention: false },
  offline: { label: "Not connected", dot: "bg-warn", attention: true },
  unpaired: { label: "Not connected", dot: "bg-warn", attention: true },
};

/** The status dot: steady green when connected, a pulsing amber one when it needs connecting. */
function ConnectionDot({ state, className }) {
  return (
    <span className={cn("relative flex size-2.5 shrink-0", className)} aria-hidden="true">
      {state.attention && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-75 motion-reduce:hidden", state.dot)} />}
      <span className={cn("relative size-2.5 rounded-full ring-2 ring-ink modern:ring-card", state.dot)} />
    </span>
  );
}

export function AppSidebar({ user, hasBugReport, hasLeaderboardAccess, onAsk = null }) {
  const pathname = usePathname();
  const [collapsedPref, setCollapsedPref] = useLocalPref(COLLAPSE_KEY, "false");
  const collapsed = collapsedPref === "true";
  const connection = CONNECTION[useConnectorStatus(Boolean(user))] ?? null;

  const nav = [
    { href: "/", label: "My board", icon: LayoutGrid, active: pathname === "/" },
    { href: "/rollup", label: "Roll-up", icon: Layers, active: pathname.startsWith("/rollup") },
    ...(hasLeaderboardAccess
      ? [
          {
            href: "/leaderboard",
            label: "Leaderboard",
            icon: Trophy,
            active: pathname.startsWith("/leaderboard"),
          },
        ]
      : []),
    ...(hasBugReport
      ? [{ href: "/bugs", label: "Bug report", icon: Bug, active: pathname.startsWith("/bugs") }]
      : []),
    // Who to call per team — every signed-in user, Support included (support-oncall.md decision 3).
    { href: "/oncall", label: "On-call", icon: LifeBuoy, active: pathname.startsWith("/oncall") },
    // Fixed-timeline SOWs / program projects, outside the scrum boards (sow-tracker.md decision 2).
    { href: "/sow", label: "SOWs", icon: Milestone, active: pathname.startsWith("/sow") },
    // Org-level and read-only, so every signed-in user (security-vulnerability-tracker.md P1).
    { href: "/security", label: "Security", icon: ShieldCheck, active: pathname.startsWith("/security") },
    // The user's own Claude Code connection (the Connector pairing, claude-connector-analysis.md),
    // for everyone. Named for what it is, with a live connected / not-connected indicator, so
    // people notice it and connect: Analyse with Claude, Ask and the SOW Slack sync all run on it.
    { href: "/settings", label: "Claude Code", icon: SquareTerminal, active: pathname.startsWith("/settings"), connection },
    ...(user?.isAdmin
      ? [{ href: "/admin", label: "Admin", icon: Settings, active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <aside
      className={cn(
        "app-sidebar sticky top-0 z-30 hidden h-screen shrink-0 flex-col bg-ink text-white transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <Link
        href="/"
        aria-label="StoryBoard — go to my board"
        className={cn(
          "flex h-14 items-center gap-2.5 px-3.5 transition-colors hover:bg-white/8",
          collapsed && "justify-center px-0",
        )}
      >
        <BrandMark tone="ink" className="size-8" />
        {!collapsed && <Wordmark onInk className="text-sm whitespace-nowrap" />}
      </Link>

      <nav className="mt-2 flex flex-col gap-1 px-2.5">
        {nav.map(({ href, label, icon: Icon, active, connection: state }) => (
          <NavLink
            key={href}
            href={href}
            title={collapsed ? (state ? `${label} — ${state.label}` : label) : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-primary text-white shadow-brand modern:bg-linear-to-r modern:from-grad-start modern:to-grad-end modern:text-primary-foreground"
                : "text-white/60 hover:bg-white/10 hover:text-white modern:text-muted-foreground modern:hover:bg-accent modern:hover:text-foreground",
              // Not connected: a quiet amber outline keeps the item noticeable until it is.
              state?.attention && !active && "text-white ring-1 ring-warn/60 modern:text-foreground",
            )}
          >
            <span className="relative shrink-0">
              <Icon className="size-[18px]" />
              {state && collapsed && <ConnectionDot state={state} className="absolute -top-1 -right-1" />}
            </span>
            {!collapsed && (
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="whitespace-nowrap">{label}</span>
                {state && (
                  <span className={cn("text-[11px] font-medium", active ? "text-white/85 modern:text-primary-foreground/85" : "text-white/55 modern:text-muted-foreground")}>
                    {state.label}
                  </span>
                )}
              </span>
            )}
            {state && !collapsed && <ConnectionDot state={state} />}
          </NavLink>
        ))}
      </nav>

      {/* Ask StoryBoard launcher (ask-storyboard.md (e)) — an action, not a page, so it sits apart
          from the nav list; ⌘/Ctrl+K opens the same panel. */}
      {onAsk && (
        <div className="mt-4 px-2.5">
          <button
            type="button"
            onClick={onAsk}
            title={collapsed ? "Ask StoryBoard (⌘K)" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border border-white/12 bg-white/6 px-2.5 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/12 hover:text-white modern:hover:bg-accent",
              collapsed && "justify-center border-transparent bg-transparent px-0",
            )}
          >
            <AudioLines className="size-[18px] shrink-0" />
            {!collapsed && (
              <>
                <span className="whitespace-nowrap">Ask StoryBoard</span>
                <kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white/60 modern:bg-muted modern:text-muted-foreground">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-auto p-2.5">
        <button
          type="button"
          onClick={() => setCollapsedPref(String(!collapsed))}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white modern:text-muted-foreground modern:hover:bg-accent modern:hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeft className="size-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="size-[18px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
