"use client";

/**
 * The roll-up page's only client leaf (ed-rollup.md decision 7): sprint selection travels in
 * `?sprint=` via router.push; everything else on /rollup is server-rendered and read-only.
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { initials } from "@/lib/utils";

export function RollupTopBar({ user, sprints, selectedSprint }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-4 py-2 shadow-xs md:flex-nowrap md:gap-4 md:px-6 md:py-0">
      <div className="flex items-center gap-3">
        <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
        <span className="hidden h-5.5 w-px bg-border sm:block" aria-hidden="true" />
        <div className="hidden leading-tight sm:block">
          <p className="font-display text-sm font-bold">Sprint Tracker</p>
          <p className="text-[11px] text-muted-foreground">Multi-team roll-up</p>
        </div>
      </div>

      {sprints.length > 0 && (
        <Select
          aria-label="Sprint"
          value={selectedSprint?.id ?? ""}
          onChange={(event) => router.push(`/rollup?sprint=${encodeURIComponent(event.target.value)}`)}
        >
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} ({sprint.state.toLowerCase()})
            </option>
          ))}
        </Select>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">My board</Link>
        </Button>
        <div
          className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
          title={`${user.displayName} · ${user.email}`}
        >
          {initials(user.displayName || user.email)}
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out">
          Logout
        </Button>
      </div>
    </header>
  );
}
