"use client";

/**
 * Risk comment editor (risk-comments-rollup-digest.md decision 3) — a small dialog opened from
 * the RiskCalloutsPanel's per-row edit affordance. Save/Remove both PUT the existing progress
 * route with `riskComment` only (independent of stage/blocked — the route never touches those
 * fields unless they're in the body); Remove sends an empty string, which the route normalizes to
 * null. The caller supplies `onSaved` to run the mutation + refresh (dashboard.jsx's `run` — the
 * house transition pattern) so this stays a dumb form.
 */
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_LENGTH = 500;

export function RiskCommentDialog({ issue, onSave, onRemove, onClose, busy }) {
  const [comment, setComment] = useState(issue.riskComment ?? "");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!comment.trim()) return setError("Enter a comment, or use Remove to clear it");
    setError("");
    onSave(comment.trim());
  };

  return (
    <Dialog open title="Risk comment" onClose={busy ? undefined : onClose}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted-foreground">
          Note a known, agreed-upon reason this item is flagged as risk (e.g. an intentionally
          late QA handoff). Visible to everyone on the board and the roll-up — it tells leadership
          the risk is managed, not a new alarm.
        </p>
        <div className="flex items-center justify-between">
          <Label>
            <span className="font-mono text-xs">{issue.jiraKey}</span> — {issue.title}
          </Label>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <Textarea
            autoFocus
            rows={4}
            maxLength={MAX_LENGTH}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="e.g. Dev/QA/PM agreed QA hand-off slips to next week — tracked, not a new risk."
            disabled={busy}
          />
          <span className="self-end text-[11px] text-muted-foreground">
            {comment.length}/{MAX_LENGTH}
          </span>
        </fieldset>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {issue.riskComment && (
            <Button type="button" variant="secondary" onClick={onRemove} disabled={busy}>
              Remove
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
