"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal controlled modal (ui-port.md decision 5 — hand-written, no radix): overlay click and ✕
 * close it; content clicks don't propagate. Render conditionally via `open`.
 */
function Dialog({ open, onClose, title, children, className }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-card text-card-foreground shadow-xl",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export { Dialog };
