"use client";

/**
 * Public links to one SOW (sow-tracker.md (g), decisions 7 and 17): mint a live, read-only link
 * that needs no sign-in, with an optional expiry, and revoke existing ones. The new link always
 * renders inline with a Copy button, so a blocked clipboard still has a manual path.
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, SectionLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";

const EXPIRY_PRESETS = [
  { value: "7", label: "Expires in 7 days" },
  { value: "30", label: "Expires in 30 days" },
  { value: "90", label: "Expires in 90 days" },
  { value: "never", label: "Never expires" },
];

const formatDate = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const shareUrl = (token) => `${window.location.origin}/sow/share/${token}`;

function ShareRow({ share, busy, onCopy, onRevoke }) {
  const { expired } = share; // decided by the server, so render stays pure
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          Created {formatDate(share.createdAt)}
          {share.createdBy && <span className="font-normal text-muted-foreground"> · {share.createdBy}</span>}
        </p>
        <p className={expired ? "text-xs font-medium text-danger-strong" : "text-xs text-muted-foreground"}>
          {!share.expiresAt ? "Never expires" : expired ? `Expired ${formatDate(share.expiresAt)}` : `Expires ${formatDate(share.expiresAt)}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onCopy(share.token)} disabled={busy || expired}>
          <Copy aria-hidden="true" />
          Copy
        </Button>
        <Button variant="ghostDestructive" size="sm" onClick={() => onRevoke(share.id)} disabled={busy}>
          <Trash2 aria-hidden="true" />
          Revoke
        </Button>
      </div>
    </li>
  );
}

export function SowShareDialog({ sow, onClose, showToast }) {
  const base = `/api/sows/${sow.id}/shares`;
  const [expiry, setExpiry] = useState("30");
  const [createdUrl, setCreatedUrl] = useState(null);
  const [shares, setShares] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadShares = useCallback(
    () =>
      apiFetch(base)
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

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      showToast("Share link copied");
      return true;
    } catch {
      setCreatedUrl(shareUrl(token));
      return false;
    }
  };

  const run = async (work) => {
    setError("");
    setBusy(true);
    try {
      await work();
      await loadShares();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () =>
    run(async () => {
      const share = await apiFetch(base, { method: "POST", body: { expiresInDays: expiry === "never" ? null : Number(expiry) } });
      setCreatedUrl(shareUrl(share.token));
      if (!(await copy(share.token))) showToast("Share link created — copy it below");
    });

  const handleRevoke = (shareId) =>
    run(async () => {
      await apiFetch(`${base}/${shareId}`, { method: "DELETE" });
      setCreatedUrl(null);
      showToast("Share link revoked");
    });

  return (
    <Dialog
      open
      hero
      icon={Link2}
      title={`Share ${sow.name}`}
      description="A read-only link to this SOW page, always showing the latest data. Anyone with the link can view it — no sign-in needed."
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <DialogClose>Close</DialogClose>
          <Button onClick={handleCreate} disabled={busy}>
            {busy && <Spinner />}
            {busy ? "Working…" : "Create link"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Callout tone="warn" title="The link shows ticket titles and assignee names">
          Share it only with people who should see the Jira work behind this SOW. Revoking stops a link at once.
        </Callout>
        <Field label="Expiry" htmlFor="sow-share-expiry">
          <Select id="sow-share-expiry" value={expiry} onChange={(event) => setExpiry(event.target.value)} disabled={busy}>
            {EXPIRY_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </Select>
        </Field>
        {createdUrl && (
          <Field label="Link" htmlFor="sow-share-url">
            <Input id="sow-share-url" readOnly value={createdUrl} onFocus={(event) => event.target.select()} className="font-mono text-xs" />
          </Field>
        )}
        <div>
          <SectionLabel>Existing links</SectionLabel>
          {shares === null ? (
            <Skeleton className="mt-2 h-10 w-full" />
          ) : shares.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <ul className="divide-y">
              {shares.map((share) => (
                <ShareRow key={share.id} share={share} busy={busy} onCopy={copy} onRevoke={handleRevoke} />
              ))}
            </ul>
          )}
        </div>
        <DialogError>{error}</DialogError>
      </div>
    </Dialog>
  );
}
