import * as React from "react";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Styled NATIVE select (ui-port.md decision 5 — no radix; options via children). The trigger is
 * fully custom (appearance-none + a drawn chevron replacing the OS glyph, hover/focus states that
 * match Input/Button); the open option list stays OS-native by design — that's the platform's job,
 * not ours, and native keeps every existing call site's keyboard/touch behavior for free.
 */
const selectVariants = cva(
  "w-full appearance-none rounded-lg border bg-background pl-3 pr-9 text-sm shadow-xs outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input text-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // Glass select for the ink hero (mirrors Button's onDark, src/styles.css .btn-on-dark).
        // The trigger is dark-glass; the OS option popup stays the browser's normal light chrome.
        onDark:
          "border-white/15 bg-white/10 text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/15 focus-visible:border-white/40 focus-visible:ring-[3px] focus-visible:ring-white/25",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const chevronVariants = cva(
  "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 transition-colors",
  {
    variants: {
      variant: {
        default: "text-muted-foreground",
        onDark: "text-white/60",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Select({ className, variant, disabled, children, ...props }) {
  return (
    <div className="group relative">
      <select
        data-slot="select"
        disabled={disabled}
        className={cn(selectVariants({ variant, className }))}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          chevronVariants({ variant }),
          !disabled && "group-hover:text-foreground group-focus-within:text-foreground",
          variant === "onDark" && !disabled && "group-hover:text-white group-focus-within:text-white",
          disabled && "opacity-50",
        )}
      />
    </div>
  );
}

export { Select };
