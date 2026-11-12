"use client";

/**
 * The SOW page's drill-in panel (sow-tracker.md round 2, decision 1): a sheet that slides in from
 * the right over the overview, so a leader can open any tile, read the granular rows, and close it
 * without losing the picture. Full-width on a phone. Esc and the scrim close it; focus moves in on
 * open and back to the opener on close. Portals to <body> like Dialog.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribe, () => true, () => false);

export function SowDrawer({ open, title, eyebrow, subtitle, onClose, footer, children }) {
  const isClient = useIsClient();
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (event) => {
      // A themed Select or a Dialog on top handles its own Escape first.
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("[role=dialog][data-top-layer]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      openerRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!isClient || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Details"}
        className={cn("sow-drawer relative flex h-full w-full max-w-2xl flex-col border-l bg-card shadow-2xl outline-none")}
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{eyebrow}</p>}
            <h2 className="mt-0.5 font-display text-lg leading-snug font-bold">{title}</h2>
            {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
