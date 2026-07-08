import * as React from "react";
import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  brand: "border-accent bg-accent text-accent-foreground",
};

/** Small status chip; `tone` matches the semantic keys emitted by lib/metrics.mjs. */
function Badge({ className, tone = "neutral", ...props }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone] ?? toneClasses.neutral,
        className,
      )}
      {...props}
    />
  );
}

export { Badge, toneClasses };
