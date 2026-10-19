"use client";

/**
 * App navigation sidebar (modern-theme.md Phase B; promoted to both themes per Naveen 2026-07-26).
 * Rendered by AppShell on the four authenticated pages, visible at lg+ widths in BOTH themes
 * (`hidden lg:flex`) and hidden below lg so mobile falls back to top-bar nav. `bg-ink` plus the
 * themed `--primary`/`--accent` tokens mean it re-hues automatically (teal active state under
 * Tekion, blue under Modern) with no per-theme branching here.
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
  PanelLeft,
  PanelLeftClose,
  Settings,
  Trophy,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, Wordmark } from "./brand";
import { NavLink } from "./nav-link";
import { useLocalPref } from "@/lib/use-local-pref";

const COLLAPSE_KEY = "sprintTracker_sidebarCollapsed";

export function AppSidebar({ user, hasBugReport, hasLeaderboardAccess, onAsk = null }) {
  const pathname = usePathname();
  const [collapsedPref, setCollapsedPref] = useLocalPref(COLLAPSE_KEY, "false");
  const collapsed = collapsedPref === "true";

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
    // Personal settings — the Claude Connector pairing (claude-connector-analysis.md), for everyone.
    { href: "/settings", label: "Settings", icon: UserCog, active: pathname.startsWith("/settings") },
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
        <BrandMark className="size-8" />
        {!collapsed && <Wordmark onInk className="text-sm whitespace-nowrap" />}
      </Link>

      <nav className="mt-2 flex flex-col gap-1 px-2.5">
        {nav.map(({ href, label, icon: Icon, active }) => (
          <NavLink
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-primary text-white shadow-brand"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
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
              "flex w-full items-center gap-3 rounded-lg border border-white/12 bg-white/6 px-2.5 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/12 hover:text-white",
              collapsed && "justify-center border-transparent bg-transparent px-0",
            )}
          >
            <AudioLines className="size-[18px] shrink-0" />
            {!collapsed && (
              <>
                <span className="whitespace-nowrap">Ask StoryBoard</span>
                <kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white/60">
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
            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white",
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
