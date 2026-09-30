"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal dialog (hand-written, no radix — ui-port.md decision 5).
 *
 * What this rebuild fixes, in order of how much it was hurting:
 *
 *  1. **Exit animation.** The old dialog animated in and then vanished on a hard unmount. Call
 *     sites mount conditionally (`{showX && <XDialog/>}`), so the dialog cannot animate itself out
 *     after the parent has dropped it — instead every close path routes through `requestClose`,
 *     which plays the out animation and *then* calls `onClose`. Exit runs faster than enter
 *     (150ms vs 200ms): entering is the system presenting itself, leaving is the system getting
 *     out of the way.
 *  2. **Focus.** There was no trap and no restore — Tab walked straight out into the page behind
 *     the scrim, and closing dropped focus onto `<body>`, losing a keyboard user's place entirely.
 *  3. **Scroll.** The page scrolled behind the modal. Locking it compensates for the scrollbar
 *     width so the layout underneath doesn't jump sideways as the dialog opens.
 *  4. **The action row scrolled away.** Buttons lived inside the scrolling body, so on the export
 *     dialog you had to scroll a long preview to reach Cancel. Footer content now sits outside the
 *     scroll region via the `footer` prop and is always reachable.
 *  5. **Tone.** A 3px colour strip is a weak signal easily missed at the top edge. Tone now reads
 *     as an icon tile beside the title — the same idiom the metric cards and panels already use,
 *     so a destructive dialog looks like it belongs to this app.
 */

const EXIT_MS = 150; // keep in lockstep with the animate-out duration below

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const TONES = {
  success: { icon: CheckCircle2, tile: "bg-success-soft text-success-strong" },
  error: { icon: AlertTriangle, tile: "bg-danger-soft text-danger-strong" },
  // A sync that succeeded but returned something suspicious (a track Jira just emptied, §14.14) is
  // neither — reporting it in the error tone would cry wolf about a run that actually worked.
  warn: { icon: AlertTriangle, tile: "bg-warn-soft text-warn-strong" },
};

/**
 * Open dialogs, innermost last. A dialog can open another (the roll-up "All risks" list opens a
 * ticket's Claude analysis), and every dialog listens for keys on `document` — without this, one
 * Escape closed both. Only the top of the stack handles Escape/Tab.
 */
const openDialogs = [];

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Width to reserve when the page's vertical scrollbar is taken away by the scroll lock.
 *
 * NOT `window.innerWidth - documentElement.clientWidth`, the usual recipe: on any page that can
 * scroll horizontally — the Delivery Matrix and the bug matrix both can — those two disagree by
 * the horizontal overflow, and under mobile emulation they disagreed by 195px. That produced a
 * huge phantom padding and caused exactly the sideways jump the compensation exists to prevent.
 *
 * Measuring a throwaway scrolling element asks the only question that matters — how wide is a
 * scrollbar here — and is unaffected by the page's own layout. Overlay scrollbars correctly
 * return 0, so nothing is reserved on macOS's default setting.
 */
function verticalScrollbarWidth() {
  const { body, documentElement } = document;
  if (documentElement.scrollHeight <= documentElement.clientHeight) return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden";
  body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

/**
 * Shared inline error block. This exact markup was hand-copied into five dialogs, which is how it
 * drifted; one component keeps a failed save looking the same wherever it happens.
 */
function DialogError({ children, className }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Dialog({
  open,
  onClose,
  title,
  description,
  tone,
  size = "md",
  footer,
  children,
  className,
}) {
  const panelRef = React.useRef(null);
  const exitTimer = React.useRef(null);
  const [leaving, setLeaving] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();

  /** Play the out animation, then hand control back to the parent, which unmounts us. */
  const requestClose = React.useCallback(() => {
    if (!onClose || exitTimer.current) return;
    setLeaving(true);
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null;
      onClose();
    }, EXIT_MS);
  }, [onClose]);

  React.useEffect(() => () => exitTimer.current && clearTimeout(exitTimer.current), []);

  // Stack membership lives in its own [open] effect with a stable token, so the key effect below
  // re-running (a new `onClose` identity on every parent render) can't reorder the stack.
  const stackToken = React.useRef({});
  React.useEffect(() => {
    if (!open) return undefined;
    const token = stackToken.current;
    openDialogs.push(token);
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
    };
  }, [open]);

  // Escape + Tab containment. Keeping both on one listener means the trap can never disagree with
  // the close handler about which dialog is on top — only the top of `openDialogs` handles either.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (openDialogs[openDialogs.length - 1] !== stackToken.current) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  // Initial focus + restore on close. Fields marked `autoFocus` have already claimed focus by the
  // time this runs, so we only step in when nothing inside the panel has it — then we focus the
  // panel itself rather than the first control, so screen readers announce the title first.
  React.useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  // Scroll lock, with scrollbar-width compensation so the page behind doesn't shift sideways.
  React.useEffect(() => {
    if (!open) return undefined;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    const scrollbar = verticalScrollbarWidth();
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  if (!open) return null;

  const toneConfig = tone ? TONES[tone] : null;
  const ToneIcon = toneConfig?.icon;

  return (
    <div
      className={cn(
        "dialog-overlay fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 backdrop-blur-md backdrop-saturate-125 sm:items-center sm:p-4",
        leaving
          ? "animate-out fade-out duration-150 ease-out"
          : "animate-in fade-in duration-200 ease-out",
      )}
      onMouseDown={(event) => {
        // mousedown, not click: a text selection that starts inside the panel and ends on the
        // backdrop fires a click on the overlay and used to close the dialog mid-edit.
        if (event.target === event.currentTarget) requestClose();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "dialog-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card text-card-foreground shadow-xl outline-none ring-1 ring-ink/10 sm:max-h-[85vh] sm:rounded-2xl",
          SIZES[size] ?? SIZES.md,
          leaving
            ? "animate-out fade-out zoom-out-95 slide-out-to-bottom-1 duration-150 ease-out"
            : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out",
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border-subtle px-5 py-4">
          {ToneIcon && (
            <span
              className={cn("mt-px grid size-8 shrink-0 place-items-center rounded-lg", toneConfig.tile)}
              aria-hidden="true"
            >
              <ToneIcon className="size-4.5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-[17px] leading-snug font-extrabold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={!onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-muted/40 px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export { Dialog, DialogError };
