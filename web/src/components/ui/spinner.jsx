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
 */
function ActivityPill({ show, label }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-medium shadow-lg"
    >
      <Spinner className="text-primary" />
      {label}
    </div>
  );
}

export { Spinner, ActivityPill };
