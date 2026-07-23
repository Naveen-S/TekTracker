"use client";

/**
 * The `/bugs` top bar — mirrors RollupTopBar (logo, product block, nav, avatar, logout) minus the
 * sprint selector: a bug report is not sprint-scoped (gm-bug-report.md decision 2).
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { initials } from "@/lib/utils";

export function BugsTopBar({ user }) {
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
          <p className="text-[11px] text-muted-foreground">Bug report</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="ghost">
          <Link href="/">My board</Link>
        </Button>
        {user.isAdmin && (
          <Button asChild variant="ghost">
            <Link href="/admin">Admin</Link>
          </Button>
        )}
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white"
          title={user.displayName}
        >
          {initials(user.displayName)}
        </span>
        <Button variant="ghost" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
