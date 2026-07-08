import * as React from "react";
import { cn } from "@/lib/utils";

/** Styled NATIVE select (ui-port.md decision 5 — no radix; options via children). */
function Select({ className, children, ...props }) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 rounded-md border border-input bg-background px-2.5 pr-8 text-sm shadow-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
