"use client";

/**
 * Share-view dialog (share-view-export.md (d)) — mints SharedView tokens against
 * POST …/shares and manages existing links (GET …/shares + DELETE /api/shares/[id]).
 * Shares the WHOLE current board (all filters — the legacy "share the exact view").
 * No router.refresh() needed: shares never change the board's server-rendered data.
 * The created link always renders inline with a Copy button, so a blocked clipboard
 * (plain-http dev) still has a manual path (decision 10).
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, SectionLabel } from "@/components/ui/field";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";

const EXPIRY_PRESETS = [
  { value: "7", label: "Expires in 7 days" },
  { value: "30", label: "Expires in 30 days" },
  { value: "never", label: "Never expires" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDay(value) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ShareDialog({ base, filters, density, onClose, showToast }) {
  const [isLive, setIsLive] = useState(true);
  const [expiry, setExpiry] = useState("7");
  const [createdUrl, setCreatedUrl] = useState(null);
  const [shares, setShares] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // setState lives in .then callbacks (async boundary explicit) so the installed
  // react-hooks/set-state-in-effect rule can see nothing fires synchronously in the effect.
  const loadShares = useCallback(
    () =>
      apiFetch(`${base}/shares`)
        .then((data) => setShares(data))
        .catch((loadError) => {
          setShares([]);
          setError(loadError.message);
        }),
    [base],
  );

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied to clipboard");
      return true;
    } catch {
      return false;
    }
  };

  const handleCreate = async () => {
    setError("");
    setBusy(true);
    try {
      const share = await apiFetch(`${base}/shares`, {
        method: "POST",
        body: {
          filterIds: filters.map((filter) => filter.id),
          isLive,
          expiresAt: expiry === "never" ? null : new Date(Date.now() + Number(expiry) * DAY_MS).toISOString(),
          viewDensity: density,
        },
      });
      const url = `${window.location.origin}${share.url}`;
      setCreatedUrl(url);
      const copied = await copyToClipboard(url);
      if (!copied) showToast("Share link created — copy it below");
      await loadShares();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (shareId) => {
    setError("");
    setBusy(true);
    try {
      await apiFetch(`/api/shares/${shareId}`, { method: "DELETE" });
      showToast("Share link revoked");
      await loadShares();
    } catch (revokeError) {
      setError(revokeError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      icon={Link2}
      hero
      title="Share view"
      description={`Shares all ${filters.length} filter${filters.length === 1 ? "" : "s"} on this board, read-only. Anyone with the link can view it — no sign-in needed.`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <DialogClose>Close</DialogClose>
          <Button onClick={handleCreate} disabled={busy || filters.length === 0}>
            {busy && <Spinner />}
            {busy ? "Working…" : "Create link"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Link type">
          <RadioCardGroup aria-label="Link type">
            {[
              { live: true, name: "Live", detail: "Always shows the latest board" },
              { live: false, name: "Frozen", detail: "A snapshot of the board right now" },
            ].map((option) => (
              <RadioCard
                key={option.name}
                name="shareType"
                value={option.name}
                checked={isLive === option.live}
                onChange={() => setIsLive(option.live)}
                disabled={busy}
                title={option.name}
                description={option.detail}
              />
            ))}
          </RadioCardGroup>
        </Field>

        <Field label="Expiry" htmlFor="share-expiry">
          <Select
            id="share-expiry"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            disabled={busy}
          >
            {EXPIRY_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </Select>
        </Field>

        {createdUrl && (
          <Callout tone="success" title="Link created">
            <div className="mt-2 flex items-center gap-2">
              <Input
                readOnly
                size="sm"
                value={createdUrl}
                className="flex-1 bg-card font-mono text-xs text-foreground"
                onFocus={(event) => event.target.select()}
              />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(createdUrl)}>
                <Copy /> Copy
              </Button>
            </div>
          </Callout>
        )}

        <DialogError>{error}</DialogError>

        <div className="flex flex-col gap-2.5">
          <SectionLabel>Existing links for this sprint</SectionLabel>
          {shares === null ? (
            <ul
              className="divide-y divide-border-subtle rounded-lg border border-border-subtle"
              aria-label="Loading share links"
            >
              {[0, 1].map((row) => (
                <li key={row} className="px-3.5 py-2.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="mt-1.5 h-2.5 w-56 max-w-full" />
                </li>
              ))}
            </ul>
          ) : shares.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3.5 py-3 text-center text-xs text-muted-foreground">
              No share links yet.
            </p>
          ) : (
            <ul className="max-h-52 divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border-subtle">
              {shares.map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 text-xs">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {share.filterNames.length > 0
                        ? share.filterNames.join(", ")
                        : `${share.filterCount} filter${share.filterCount === 1 ? "" : "s"}`}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {share.isLive ? "Live" : "Frozen"} · created {formatDay(share.createdAt)} by{" "}
                      {share.createdBy} ·{" "}
                      {share.expiresAt ? `expires ${formatDay(share.expiresAt)}` : "never expires"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Copy link"
                      aria-label="Copy link"
                      onClick={() => copyToClipboard(`${window.location.origin}${share.url}`)}
                    >
                      <Copy />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghostDestructive"
                      className="size-8"
                      title="Revoke link"
                      aria-label="Revoke link"
                      disabled={busy}
                      onClick={() => handleRevoke(share.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
