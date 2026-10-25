"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import { AlertDialog } from "@/components/dashboard/alert-dialog";
import { apiFetch } from "@/lib/api-client";

/**
 * The only client leaf on /security (security-vulnerability-tracker.md (d)): the program picker and
 * the admin Refresh. The last choice is remembered per browser under `sprintTracker_securityProgram`
 * (a UI pref, §17) and re-applied when /security is opened with no `?program=`. Every storage access
 * is guarded — a private window must still render.
 *
 * Refresh runs inside a transition so the loader spans the API call AND the re-render (the
 * BugsActions pattern). A dev refresh against Neon takes 30–60 s, so it blocks with the full loader.
 */
const PROGRAM_KEY = "sprintTracker_securityProgram";

function readStored() {
  try {
    return window.localStorage.getItem(PROGRAM_KEY);
  } catch {
    return null;
  }
}

function store(value) {
  try {
    window.localStorage.setItem(PROGRAM_KEY, value);
  } catch {
    // Storage unavailable (private window) — the URL still carries the choice.
  }
}

export function SecurityActions({ programs, selectedKey, explicit, canRefresh, onDark = false, remember = false }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);
  const [toast, showToast] = useToast();
  const inFlight = busy || pending;

  // Only the instance given `remember` applies the stored program (the page header passes it).
  useEffect(() => {
    if (!remember) return;
    if (explicit) {
      store(selectedKey);
      return;
    }
    const saved = readStored();
    if (saved && saved !== selectedKey && (saved === "ALL" || programs.some((program) => program.key === saved))) {
      startTransition(() => router.replace(`/security?program=${encodeURIComponent(saved)}`));
    }
  }, [remember, explicit, selectedKey, programs, router]);

  const choose = (event) => {
    const next = event.target.value;
    store(next);
    startTransition(() => router.push(`/security?program=${encodeURIComponent(next)}`));
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const result = await apiFetch("/api/security/refresh", { method: "POST" });
      startTransition(() => {
        router.refresh();
        showToast(
          `Refreshed — ${result.pipeline} open across ${result.programs.length} programs` +
            (result.warnings.length ? ` · ${result.warnings.length} vocabulary warning(s)` : ""),
        );
      });
    } catch (caught) {
      setAlert({ title: "Refresh failed", body: caught.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedKey} onChange={choose} disabled={inFlight} aria-label="Program" variant={onDark ? "onDark" : undefined}>
          <option value="ALL">All programs</option>
          {programs.map((program) => (
            <option key={program.key} value={program.key}>
              {program.name} ({program.key})
            </option>
          ))}
        </Select>
        {canRefresh && (
          <Button variant={onDark ? "onDark" : "outline"} onClick={refresh} disabled={inFlight}>
            <RefreshCw className={inFlight ? "size-4 animate-spin" : "size-4"} />
            {inFlight ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      </div>
      <PageLoader show={busy} label="Refreshing the vocabulary and Jira mirror…" />
      <AlertDialog alert={alert} onClose={() => setAlert(null)} />
      <Toast toast={toast} />
    </>
  );
}
