"use client";

/**
 * The `/bugs` top bar — mirrors RollupTopBar (logo, product block, nav, avatar, logout) minus the
 * sprint selector: a bug report is not sprint-scoped (gm-bug-report.md decision 2).
 */
import Image from "next/image";
import { Wordmark } from "@/components/ui/brand";
import { NavLink } from "@/components/ui/nav-link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { apiFetch } from "@/lib/api-client";

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
      <div className="flex items-center gap-3 lg:hidden">
        <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
        <span className="hidden h-5.5 w-px bg-border sm:block" aria-hidden="true" />
        <div className="hidden leading-tight sm:block">
          <Wordmark className="block text-sm" />
          <p className="text-[11px] text-muted-foreground">Bug report</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="ghost" className="lg:hidden">
          <NavLink href="/">My board</NavLink>
        </Button>
        {user.isAdmin && (
          <Button asChild variant="ghost" className="lg:hidden">
            <NavLink href="/admin">Admin</NavLink>
          </Button>
        )}
        <ThemeToggle />
        <AvatarChip name={user.displayName} />
        <Button variant="ghost" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
