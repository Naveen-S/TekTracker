"use client";

/**
 * App shell (modern-theme.md Phase B; sidebar promoted to both themes per Naveen 2026-07-26) —
 * wraps the four authenticated pages (`/`, `/rollup`, `/bugs`, `/admin`). It renders the left-nav
 * sidebar alongside the page's existing chrome (top bar + main), passed through as `children`.
 *
 * The sidebar is `hidden lg:flex` (see AppSidebar) — visible in both themes at lg+, and hidden
 * below lg where the top bar's own nav links take over so mobile isn't cramped. `/login` and
 * `/share` deliberately do NOT use the shell.
 */
import { AppSidebar } from "./app-sidebar";

export function AppShell({ user, hasBugReport = false, children }) {
  return (
    <div className="app-shell flex min-h-screen">
      <AppSidebar user={user} hasBugReport={hasBugReport} />
      <div className="app-main flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
