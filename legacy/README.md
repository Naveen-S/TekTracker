# Legacy Sprint Tracker (Vite prototype) — retired

This is the original single-user Sprint Tracker prototype (Vite 2 + React 18 frontend,
Express proxy on :3001, all state in browser `localStorage`), **retired on 2026-07-18** when the
Next.js app was promoted from `web/` to the repository root (Production Migration Plan step 10).

It is kept as a **reference backup** — for design comparisons and behavior questions — not for
active development. Its architecture is documented in `context/project-overview.md` §7.

## Running it (reference only)

Requires **Node 20** (the repo root is Node 22+; this app was never verified on 22):

```bash
nvm use 20
cd legacy
yarn install   # if node_modules is missing
yarn dev:all   # Vite on :3000 + Express proxy on :3001
```

Jira credentials are entered in the login screen (stored in an Express session file store under
`.sessions/` — plaintext; this is one of the reasons the app was replaced, see
`context/project-overview.md` §13).
