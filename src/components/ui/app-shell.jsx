"use client";

/**
 * App shell (modern-theme.md Phase B) — wraps the four authenticated pages (`/`, `/rollup`,
 * `/bugs`, `/admin`). It renders the Modern-theme sidebar alongside the page's existing chrome
 * (top bar + main), passed through as `children`.
 *
 * The layout swap is CSS-driven, not SSR-driven (decision 3): the theme is a client-only
 * localStorage value the server can't see, so BOTH chromes live in the DOM and the `theme-modern`
 * class reveals the right one. Under Tekion the sidebar is `hidden` → `app-main` is full width and
 * the page renders exactly as before. `/login` and `/share` deliberately do NOT use the shell.
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
