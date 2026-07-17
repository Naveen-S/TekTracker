import { cn } from "@/lib/utils";

function Spinner({ className }) {
  return (
    <span
      data-slot="spinner"
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Full-page work-in-flight overlay — covers the window between a mutation and the
 * router.refresh() re-render landing. Blocks interaction while data is stale; the
 * backdrop + centered ink panel follow the dialog overlay system (ui/dialog.jsx).
 */
function PageLoader({ show, label }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px] animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-2.5 rounded-xl bg-ink px-5 py-3.5 text-sm font-semibold text-white shadow-xl">
        <Spinner className="size-4 text-on-ink-accent" />
        {label}
      </div>
    </div>
  );
}

export { Spinner, PageLoader };
