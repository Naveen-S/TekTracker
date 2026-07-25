"use client";

/**
 * Modern-theme navigation sidebar (modern-theme.md Phase B). Rendered by AppShell on the four
 * authenticated pages, but only VISIBLE under the Modern theme at lg+ widths: `hidden modern:lg:flex`
 * keeps it out of the DOM's flow under Tekion (Tekion's top-bar-only layout is byte-for-byte
 * unchanged) and below lg (Modern falls back to top-bar nav, so mobile isn't cramped).
 *
 * Nav owns the cross-page links under Modern at lg+ (the top bars hide theirs via `modern:lg:hidden`).
 * Collapse ↔ icon-rail state is a third ephemeral localStorage pref (§17).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, Layers, LayoutGrid, PanelLeft, PanelLeftClose, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalPref } from "@/lib/use-local-pref";

const COLLAPSE_KEY = "sprintTracker_sidebarCollapsed";

export function AppSidebar({ user, hasBugReport }) {
  const pathname = usePathname();
  const [collapsedPref, setCollapsedPref] = useLocalPref(COLLAPSE_KEY, "false");
  const collapsed = collapsedPref === "true";

  const nav = [
    { href: "/", label: "My board", icon: LayoutGrid, active: pathname === "/" },
    { href: "/rollup", label: "Roll-up", icon: Layers, active: pathname.startsWith("/rollup") },
    ...(hasBugReport
      ? [{ href: "/bugs", label: "Bug report", icon: Bug, active: pathname.startsWith("/bugs") }]
      : []),
    ...(user?.isAdmin
      ? [{ href: "/admin", label: "Admin", icon: Settings, active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <aside
      className={cn(
        "app-sidebar sticky top-0 z-30 hidden h-screen shrink-0 flex-col bg-ink text-white transition-[width] duration-300 ease-out modern:lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2.5 px-3.5", collapsed && "justify-center px-0")}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-extrabold text-white">
          T
        </span>
        {!collapsed && <span className="font-display text-sm font-bold whitespace-nowrap">Sprint Tracker</span>}
      </div>

      <nav className="mt-2 flex flex-col gap-1 px-2.5">
        {nav.map(({ href, label, icon: Icon, active }) => (
          <Link
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
          </Link>
        ))}
      </nav>

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
