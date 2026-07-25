"use client";

import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalPref } from "@/lib/use-local-pref";

/**
 * Ordered theme list. Index 0 is the default and must match globals.css `:root`
 * (Tekion). Adding a third theme is: append here + a `:root.theme-<id>` block.
 */
const THEMES = [
  { id: "tekion", label: "Tekion" },
  { id: "modern", label: "Modern" },
];

/**
 * Theme switcher (modern-theme.md). The choice is an ephemeral UI pref (§17):
 * stored in localStorage via useLocalPref, applied by toggling the `theme-modern`
 * class on <html>. The switch is imperative (no <html> re-render) so it lands
 * instantly; the no-FOUC boot script in layout.jsx applies the same class before
 * first paint on later loads. Lives in the top bar, so it is reachable in BOTH
 * themes (the Modern sidebar is hidden under Tekion).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useLocalPref("theme", THEMES[0].id);
  const index = Math.max(
    0,
    THEMES.findIndex((entry) => entry.id === theme),
  );
  const current = THEMES[index];
  const next = THEMES[(index + 1) % THEMES.length];

  const switchTheme = () => {
    const root = document.documentElement;
    // "Wow" cross-fade only during the switch (globals.css `.theme-transition`;
    // guarded by prefers-reduced-motion, so this is a no-op when motion is reduced).
    root.classList.add("theme-transition");
    root.classList.toggle("theme-modern", next.id === "modern");
    setTheme(next.id);
    window.setTimeout(() => root.classList.remove("theme-transition"), 450);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchTheme}
      title={`Theme: ${current.label} — switch to ${next.label}`}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
    >
      <Palette />
      <span className="hidden sm:inline">{current.label}</span>
    </Button>
  );
}
