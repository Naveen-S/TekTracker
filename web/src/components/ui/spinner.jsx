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
 * Floating work-in-flight indicator — covers the window between a mutation and the
 * router.refresh() re-render landing, when nothing else on screen signals activity.
 * Ink pill styling matches the toast (legacy .share-toast surface).
 */
function ActivityPill({ show, label }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <Spinner className="text-on-ink-accent" />
      {label}
    </div>
  );
}

export { Spinner, ActivityPill };
