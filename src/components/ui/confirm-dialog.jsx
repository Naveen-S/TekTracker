"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, useDialog } from "@/components/ui/dialog";

/**
 * Confirmation step before an irreversible or overwriting action (dialog-redesign.md). Six
 * call sites had each hand-built the same small dialog. This is the one version: Cancel, then the
 * confirm button on the right, with the body copy styled the same everywhere.
 *
 * Confirming starts the exit animation and runs `onConfirm` straight away. The caller clears its
 * "confirming" state in `onClose`, which fires once the exit has played, so callers should not clear
 * it inside `onConfirm` as well. A second click during the exit is ignored.
 *
 * @param {{ title: React.ReactNode, description?: React.ReactNode, confirmLabel: React.ReactNode,
 *   tone?: "danger" | "warn" | "info", destructive?: boolean, onConfirm: () => void,
 *   onClose: () => void, children?: React.ReactNode }} props
 */
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = "danger",
  destructive = tone === "danger",
  onConfirm,
  onClose,
  children,
}) {
  return (
    <Dialog
      open
      title={title}
      description={description}
      tone={tone}
      hero
      size="sm"
      onClose={onClose}
      footer={
        <>
          <DialogClose />
          <ConfirmButton destructive={destructive} onConfirm={onConfirm}>
            {confirmLabel}
          </ConfirmButton>
        </>
      }
    >
      {children && (
        <div className="space-y-2 text-center text-sm leading-relaxed text-pretty text-foreground/90">
          {children}
        </div>
      )}
    </Dialog>
  );
}

function ConfirmButton({ destructive, onConfirm, children }) {
  const { close } = useDialog();
  const fired = React.useRef(false);
  return (
    <Button
      type="button"
      variant={destructive ? "destructive" : "default"}
      onClick={() => {
        if (fired.current) return;
        fired.current = true;
        close();
        onConfirm();
      }}
    >
      {children}
    </Button>
  );
}

export { ConfirmDialog };
