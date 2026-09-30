"use client";

/**
 * The per-ticket "Analyse with Claude" affordance (claude-connector-analysis.md decision 6): a small
 * sparkle beside the Jira key. Filled when the ticket already has a saved analysis. Renders nothing
 * unless an `AnalysisProvider` says the feature is enabled.
 *
 * The dialog is PORTALLED to `document.body`: this button lives inside row cells that create their
 * own stacking context (the Delivery Matrix's `sticky z-1` key column), and a `fixed` dialog
 * rendered in place stays trapped inside it — neighbouring sticky cells and the matrix header then
 * paint over the modal. Portalling escapes every ancestor stacking context. Safe for SSR: `open`
 * only becomes true from a click, i.e. after hydration.
 *
 * @param {{ jiraKey: string, source: "BUG" | "SPRINT", title?: string, jiraBaseUrl?: string | null,
 *   className?: string }} props
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalysis } from "@/components/analysis/analysis-context";
import { IssueAnalysisDialog } from "@/components/analysis/issue-analysis-dialog";

export function AnalyseButton({ jiraKey, source, title, jiraBaseUrl, className }) {
  const { enabled, isAnalyzed } = useAnalysis();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  const analyzed = isAnalyzed(jiraKey);
  const label = analyzed ? `View Claude analysis of ${jiraKey}` : `Analyse ${jiraKey} with Claude`;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title={label}
        aria-label={label}
        className={cn(
          "inline-grid size-6 shrink-0 place-items-center rounded-md outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
          analyzed
            ? "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          className,
        )}
      >
        <Sparkles className="size-3.5" fill={analyzed ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <IssueAnalysisDialog
            jiraKey={jiraKey}
            source={source}
            title={title}
            jiraBaseUrl={jiraBaseUrl}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
