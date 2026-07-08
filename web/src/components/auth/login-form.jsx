"use client";

/**
 * Login card — port of the prototype's LoginForm onto the web/ auth route (§11 copy: connect your
 * Jira account; API-token hint; Tekion footer). Same POST /api/auth/login contract (step 3).
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), token: token.trim() },
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Image src="/tekion-logo.svg" alt="Tekion" width={120} height={28} priority />
          <h1 className="mt-2 text-xl font-semibold">Sprint Tracker</h1>
          <p className="text-sm text-muted-foreground">Connect your Jira account to get started</p>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Jira Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@tekion.com"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-token">API Token</Label>
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                Create token ↗
              </a>
            </div>
            <Input
              id="login-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your Jira API token"
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Find this at id.atlassian.com → Security → API tokens
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Connecting…" : "Connect to Jira"}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Engineering · Internal Tool · Tekion Corp
        </p>
      </div>
    </main>
  );
}
