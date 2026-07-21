"use client";

/**
 * "AI Digest" button + dialog for `/rollup` (risk-comments-rollup-digest.md decision 8) — the
 * ai-insights.md "roll-up digest" fast follow. Mirrors the Hero's team-board AI Digest button
 * (Sparkles, onDark) but posts to the flat `/api/rollup/ai-digest` route with `{ sprintId }` in
 * the body, and reuses `AiDigestDialog` via its generalized `endpoint`/`body`/`intro` props
 * instead of forking a second dialog component.
 */
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { AiDigestDialog } from "@/components/dashboard/ai-digest-dialog";

const ROLLUP_INTRO =
  "Generate a portfolio-wide leadership digest — headline, narrative, and cross-team risk " +
  "call-outs — comparing every team in this sprint. Known/acknowledged risks are reported as " +
  "managed context, not new alarms. Copy it into your weekly update.";

export function RollupDigestButton({ sprintId, jiraBaseUrl }) {
  const [open, setOpen] = useState(false);
  const [toast, showToast] = useToast();

  return (
    <>
      <Button variant="onDark" size="sm" onClick={() => setOpen(true)}>
        <Sparkles /> AI Digest
      </Button>
      {open && (
        <AiDigestDialog
          endpoint="/api/rollup/ai-digest"
          body={{ sprintId }}
          jiraBaseUrl={jiraBaseUrl}
          intro={ROLLUP_INTRO}
          onClose={() => setOpen(false)}
          showToast={showToast}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}
