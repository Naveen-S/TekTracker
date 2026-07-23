"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import { AlertDialog } from "@/components/dashboard/alert-dialog";
import { apiFetch } from "@/lib/api-client";

/**
 * The only client leaf on /bugs (gm-bug-report.md (g)1): the report switcher + Refresh.
 *
 * The mutation runs inside a React transition so `busy` spans the API call AND the
 * `router.refresh()` re-render — the house pattern; without it the loader clears while the page
 * is still showing stale numbers. A refresh can take 20–40 s against a large universe, so it
 * blocks with the full-page loader rather than a subtle spinner.
 */
export function BugsActions({ report, reports, canRefresh }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);
  const [toast, showToast] = useToast();

  const inFlight = busy || pending;

  const refresh = async () => {
    setBusy(true);
    try {
      const result = await apiFetch(`/api/bug-reports/${report.id}/refresh`, { method: "POST" });
      startTransition(() => {
        router.refresh();
        showToast(
          `Refreshed — ${result.totalIssues} bug${result.totalIssues === 1 ? "" : "s"} across ${
            result.scopes.length
          } scope${result.scopes.length === 1 ? "" : "s"}`,
        );
      });
    } catch (caught) {
      setAlert({ title: "Refresh failed", body: caught.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const switchReport = (event) => {
    const next = reports.find((candidate) => candidate.id === event.target.value);
    if (next) startTransition(() => router.push(`/bugs/${next.slug}`));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {reports.length > 1 && (
          <Select
            value={report.id}
            onChange={switchReport}
            disabled={inFlight}
            aria-label="Bug report"
            className="onDark"
          >
            {reports.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </Select>
        )}
        {canRefresh && (
          <Button variant="onDark" onClick={refresh} disabled={inFlight}>
            <RefreshCw className={inFlight ? "size-4 animate-spin" : "size-4"} />
            {inFlight ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      </div>

      {inFlight && <PageLoader label="Refreshing from Jira…" />}
      <AlertDialog alert={alert} onClose={() => setAlert(null)} />
      <Toast toast={toast} />
    </>
  );
}
