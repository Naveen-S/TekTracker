import * as React from "react";
import { cn } from "@/lib/utils";

/* Legacy tint pairs (src/styles.css :34-45): soft bg + strong text per semantic tone. */
const toneClasses = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/30 bg-info-soft text-info-strong",
  success: "border-success/35 bg-success-soft text-success-strong",
  warn: "border-warn/35 bg-warn-soft text-warn-strong",
  danger: "border-danger/30 bg-danger-soft text-danger-strong",
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
