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
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
    <Dialog
      open
      title="Risk comment"
      description="Note a known, agreed-upon reason this item is flagged — e.g. an intentionally late QA hand-off. Visible on the board and the roll-up, so leadership reads it as managed, not as a new alarm."
      onClose={busy ? undefined : onClose}
      footer={
        <>
          {issue.riskComment && (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
              onClick={onRemove}
              disabled={busy}
            >
              Remove comment
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="risk-comment-form" disabled={busy}>
            {busy && <Spinner />}
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="risk-comment-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="rounded-md border border-border-subtle bg-muted/40 px-3 py-2">
          <Label className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-xs text-primary">{issue.jiraKey}</span>
            <span className="min-w-0 font-normal text-muted-foreground">{issue.title}</span>
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

        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
