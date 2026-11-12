/**
 * /sow/share/[token] — the public, read-only view of one SOW (sow-tracker.md (f), decisions 7
 * and 17). Session-less like /share/[token]: the token is the bearer capability, so there is NO
 * auth gate, no redirect to /login and no app chrome. Unknown, expired and revoked tokens all
 * render the same generic state. Always live.
 */
import Image from "next/image";
import { BrandTagline, Wordmark } from "@/components/ui/brand";
import { Badge } from "@/components/ui/badge";
import { getSharedSowData } from "@/lib/sow/data";
import { SowPage } from "@/components/sow/sow-page";

export const dynamic = "force-dynamic";

// Capability URLs must never be indexed or followed.
export const metadata = {
  title: "Shared SOW — StoryBoard",
  robots: { index: false, follow: false },
};

function ShareChrome({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2 md:px-6">
        <div className="flex items-center gap-3">
          <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
          <div className="hidden border-l border-border-subtle pl-3 sm:block">
            <Wordmark className="block text-sm leading-tight font-extrabold" />
            <BrandTagline className="block text-[13px] leading-tight text-muted-foreground" />
          </div>
        </div>
        <Badge tone="neutral">Shared view · read-only</Badge>
      </header>
      {children}
      <footer className="border-t border-border-subtle px-4 py-3 text-center text-[11px] text-muted-foreground">
        Engineering Internal Tool @ Tekion Corp.
      </footer>
    </div>
  );
}

export default async function SharedSowRoute({ params }) {
  const { token } = await params;
  const view = await getSharedSowData(token);
  if (!view) {
    return (
      <ShareChrome>
        <main className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
          <h1 className="font-display text-xl font-bold">This link is no longer available</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            It may have expired or been revoked. Ask whoever shared it for a new link.
          </p>
        </main>
      </ShareChrome>
    );
  }
  return (
    <ShareChrome>
      <SowPage view={view} readOnly />
    </ShareChrome>
  );
}
