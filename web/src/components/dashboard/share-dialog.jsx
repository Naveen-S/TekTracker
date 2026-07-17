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
import { Copy, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Dialog open title="Share View" onClose={busy ? undefined : onClose}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <Label>Link type</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { live: true, name: "Live", detail: "Always shows the latest board" },
              { live: false, name: "Frozen", detail: "A snapshot of the board right now" },
            ].map((option) => (
              <label
                key={option.name}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${isLive === option.live ? "border-ring bg-accent" : "hover:border-border-strong"}`}
              >
                <input
                  type="radio"
                  name="shareType"
                  checked={isLive === option.live}
                  onChange={() => setIsLive(option.live)}
                  disabled={busy}
                />
                <span>
                  {option.name}
                  <span className="block text-xs text-muted-foreground">{option.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="share-expiry">Expiry</Label>
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
          </div>
          <Button onClick={handleCreate} disabled={busy || filters.length === 0}>
            {busy ? "Working…" : "Create share link"}
          </Button>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Shares all {filters.length} filter{filters.length === 1 ? "" : "s"} on this board,
          read-only. Anyone with the link can view it — no sign-in needed.
        </p>

        {createdUrl && (
          <div className="flex items-center gap-2 rounded-md border border-success-strong/40 bg-success-soft p-2">
            <Input
              readOnly
              value={createdUrl}
              className="flex-1 bg-card font-mono text-xs"
              onFocus={(event) => event.target.select()}
            />
            <Button size="sm" variant="secondary" onClick={() => copyToClipboard(createdUrl)}>
              <Copy /> Copy
            </Button>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
          <Label>Existing links for this sprint</Label>
          {shares === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground">No share links yet.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-2.5 py-1.5"
                >
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-semibold">
                      {share.filterNames.length > 0
                        ? share.filterNames.join(", ")
                        : `${share.filterCount} filter${share.filterCount === 1 ? "" : "s"}`}
                    </p>
                    <p className="text-muted-foreground">
                      {share.isLive ? "Live" : "Frozen"} · created {formatDay(share.createdAt)} by{" "}
                      {share.createdBy} ·{" "}
                      {share.expiresAt ? `expires ${formatDay(share.expiresAt)}` : "never expires"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Copy link"
                      onClick={() => copyToClipboard(`${window.location.origin}${share.url}`)}
                    >
                      <Copy />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Revoke link"
                      className="text-danger-strong hover:text-danger-strong"
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

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
