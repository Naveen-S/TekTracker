"use client";

import { LayoutGrid, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalPref } from "@/lib/use-local-pref";

/**
 * The /security "look" (Naveen 2026-10-20): the StoryBoard frame by default, the artifact frame on
 * request. A per-browser UI pref (§17), so it is localStorage, never domain data. The wrapper only
 * sets `data-sec-look`; globals.css swaps the neutral tokens and the `sec-artifact:` variant swaps
 * the frame, so no panel needs to know which look is active and nothing re-fetches.
 *
 * Server render + first paint use the default ("app"); a stored "artifact" applies on hydration.
 */
const LOOK_KEY = "sprintTracker_securityLook";
const LOOKS = [
  { value: "app", label: "StoryBoard", icon: LayoutGrid },
  { value: "artifact", label: "Artifact", icon: Palette },
];

export function SecurityLook({ children }) {
  const [look] = useLocalPref(LOOK_KEY, "app");
  return (
    <div data-sec-look={look === "artifact" ? "artifact" : "app"} className="flex min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}

export function SecurityLookToggle({ onDark = false }) {
  const [look, setLook] = useLocalPref(LOOK_KEY, "app");
  const current = look === "artifact" ? "artifact" : "app";
  return (
    <div
      role="radiogroup"
      aria-label="Page look"
      className={cn("inline-flex items-center gap-0.5 rounded-lg p-0.5", onDark ? "bg-white/10" : "bg-sec-lavender")}
    >
      {LOOKS.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={value === "app" ? "StoryBoard look" : "The Vulnerability Tracker artifact's look"}
            onClick={() => setLook(value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
              active
                ? onDark
                  ? "bg-white text-ink shadow-sm"
                  : "bg-white text-sec-ink shadow-sm"
                : onDark
                  ? "text-white/70 hover:text-white"
                  : "text-sec-muted hover:text-sec-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
