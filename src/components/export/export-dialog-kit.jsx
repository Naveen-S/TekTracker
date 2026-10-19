"use client";

/**
 * Chrome shared by the three export dialogs — sprint, roll-up, bug report (dialog-redesign.md).
 * Each had hand-copied the same page pager and preview frame, and they had drifted apart. These
 * sit in the dialog's `footerStart` slot and body. The print pages themselves live in print-kit.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Previous / "Page n of N" / next. Renders nothing for a single page unless `always` is set. */
export function PreviewPager({ index, total, onChange, label, always = false }) {
  if (total <= 1 && !always) return null;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-0.5">
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Previous page"
        onClick={() => onChange(Math.max(0, index - 1))}
        disabled={index === 0}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-20 px-1 text-center text-xs font-medium text-muted-foreground tabular-nums">
        {label ? `${label} · ` : "Page "}
        {index + 1} of {total}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Next page"
        onClick={() => onChange(Math.min(total - 1, index + 1))}
        disabled={index >= total - 1}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** The tinted canvas a report's paper preview sits on, with its caption row. */
export function PreviewCanvas({ orientation, children }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-preview-canvas p-2 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
        <span>Preview · A4 {orientation}</span>
        <span className="font-medium text-foreground/80">Internal</span>
      </div>
      {children}
    </div>
  );
}
