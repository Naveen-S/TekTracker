"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_STRIPS = {
  success: "bg-success",
  error: "bg-danger",
};

/**
 * Minimal controlled modal (ui-port.md decision 5 — hand-written, no radix): overlay click and ✕
 * close it; content clicks don't propagate. Render conditionally via `open`. Overlay/panel get the
 * legacy blur + rise entrance (src/styles.css :1203-1236); `tone` adds the 3px header strip.
 */
function Dialog({ open, onClose, title, tone, children, className }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {tone && TONE_STRIPS[tone] && (
          <span className={cn("absolute inset-x-0 top-0 h-0.75", TONE_STRIPS[tone])} aria-hidden="true" />
        )}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export { Dialog };
