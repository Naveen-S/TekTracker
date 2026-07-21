# AI insights (post-v1 item 2 — provider-agnostic AI platform + risk call-outs & leadership narrative)

## Overview

Build the **last open post-v1 item** from the master plan (step 10's "then Gemini — risk call-outs +
narrative first"), reframed per Naveen (2026-07-20): the integration is a **provider-agnostic AI
platform**, not a Gemini feature. Gemini is merely the *first adapter*; the app must be able to
switch providers (downtime, cost, any reason) without touching feature code. This closes
project-overview §5's "AI summary" [GAP] row and §14.10 ("Gemini has no defined use case"), and
implements the first two of the four §16-ratified use cases — **risk/blocker call-outs** and the
**leadership narrative** — which need no new data plumbing beyond what §12's metrics, the
`SprintSnapshot` trend series, and the step-7 snapshots already provide. The deterministic
`RiskCalloutsPanel` (trend-burndown iteration, 2026-07-19) is the forerunner: this feature layers an
AI-written digest **on the same inputs**, it does not replace the deterministic panel.

The product surface is an on-demand **"AI Digest" dialog** on the team board: one click generates a
short leadership update (headline + narrative paragraphs + ranked risk call-outs) that an EM/Lead
can copy into their weekly update upward (§2.2/§2.3 — the exact writing task §16 approved Gemini
for).

> **Key architectural shift: all AI specifics live behind one neutral contract in `src/lib/ai/`** —
> the same isolation rule §17 applies to Jira (`lib/jira/` is the only module that knows Jira
> endpoints/fields). Feature code calls `generateJson({ system, prompt, schema })` and never knows
> which provider answered; the provider is selected by `AI_PROVIDER` env at request time, and each
> provider's key can be configured simultaneously — **switching providers is an env flip + restart,
> zero code changes**. Two adapters ship in v1 (Gemini + Anthropic) precisely so the abstraction is
> proven by a real second implementation, not asserted.

No schema change, no migration, **no new dependencies** (adapters are thin `fetch` wrappers), one
new API route.

## Status

**Done 2026-07-20** — all 10 decisions implemented as proposed. Implemented: the platform
(`src/lib/ai/provider.js` — lazy `getAiConfig`/`isAiConfigured`, `generateJson` with parse →
zod → one repair retry; `errors.js`; fetch-only `adapters/gemini.js` + `adapters/anthropic.js`),
the pure digest layer (`src/lib/ai/digest.mjs` — `buildDigestInput`/`buildDigestPrompt`/
`sanitizeDigest`, worst-N mirror of the risk panel; `src/lib/schemas/ai.js` — zod contract +
strict JSON-schema rendering), `POST …/ai-digest` (RBAC `TEAM_ALL_ROLES`, `getDigestData` in
`dashboard-data.js`, 503/502 mappings + a 400 empty-board guard), the UI
(`ai-digest-dialog.jsx`, Hero "AI Digest" button, `Dashboard` wiring on server-provided
`aiEnabled`), and the `.env.example` AI block. **No schema change, no migration, no new deps, one
new route.** Verified: **39/39 plain-Node fixtures** (digest input off REAL
`computeSprintMetrics`/`buildTrendSeries` outputs — hand-checked projection date `2026-07-23`,
worst-N order/cap/overflow, prompt determinism + injection-guard lines, sanitize, zod contract,
JSON-schema lockstep); lint clean; `prisma validate`/`migrate status` up to date; **DB/env-free
build green — 28 ƒ Dynamic** (exactly the new ai-digest route added); **25/25 SSR/API smoke on
dev+Neon** (fabricated SHAI team/sprints/users w/ minted cookies + **contract-faithful mock
Gemini/Anthropic servers** asserting the wire shapes: 401/403/404/400 gates, VIEWER 200 w/
sanitized hallucinated key, **the swap proof — flipping `AI_PROVIDER` gemini→anthropic returned
the identical normalized digest with zero code changes**, garbage→repair-retry→200,
garbage-always/HTTP-500/refusal → 502, dormant 503 + hidden button, unknown provider → loud 500,
share page renders with **no AI affordance**); fixture torn down to **0 leftovers**, harness
deleted, `.env` restored byte-identical, dev server left healthy. ⚠️ Human acceptance (Naveen):
set a real `AI_PROVIDER`/key, read a real digest, flip providers once end-to-end.

## As-built notes (vs. the spec)

- **`src/lib/ai/errors.js` split out** (the spec put errors in `provider.js`) — provider imports
  the adapters and the adapters need the error types, so a shared errors module avoids the
  circular import. `providerHttpError` curates non-2xx replies: status + the provider's own
  `error.message` truncated to 200 chars — never the raw payload.
- **Gemini API key goes in the `x-goog-api-key` HEADER**, not the docs' `?key=` query-param form —
  query-string keys land in server logs. The mock asserts no key ever appears in the URL.
- **`GEMINI_BASE_URL`/`ANTHROPIC_BASE_URL` override envs added** (documented as advanced in
  `.env.example`) — the step-5 mock precedent needed an env-pointable endpoint; Jira had one
  naturally, the AI adapters didn't. Defaults are the real endpoints; overrides exist for
  tests/proxies only.
- **`toGeminiSchema` strips `additionalProperties` recursively** — Gemini's Schema dialect is a
  JSON-Schema subset without it (the strict rendering stays for Anthropic; zod remains the real
  gate). Mock-asserted on the wire.
- **Route adds a 400 "Nothing to summarize yet" guard** at `metrics.totalIssues === 0` (not in
  the spec) — no provider spend on an empty board; smoke-checked via a filterless sprint.
- **`isAiConfigured()` is `AI_PROVIDER`-set only** — a *misconfigured* provider (unknown value,
  missing key) keeps the button visible and fails the route with a loud 500, per decision 3's
  loud-fail intent; only the fully-unset state is dormant/hidden.
- **Hero button also hidden on the welcome state** (`!showWelcome`) — an empty board pairs with
  the 400 guard rather than offering a dead button.
- **Repair retry re-sends the ORIGINAL prompt + rejection note** (not a chained conversation) —
  both adapters are single-turn; simpler and provider-neutral.
- **Fixtures feed `buildDigestInput` from the REAL pure metrics functions**
  (`computeSprintMetrics`/`buildTrendSeries`/`snapshotVelocity`), not synthetic shapes — the
  zod-contract checks ride an ESM-rename copy (`ai.js` → `.mjs`, the auth-layer harness
  precedent).
- **Smoke found one harness bug, zero app bugs:** the mock's prompt parser initially choked on
  the repair-retry prompt (rejection text appended after the JSON payload) — fixed by
  brace-extraction in the mock; a real provider never parses the prompt. Also: this machine's
  ancient `lsof` rejects multi-port syntax (`-ti :A :B`) — kill mock ports one at a time.
- **Model defaults verified at implementation time** (decision 9): `gemini-3.5-flash` (current
  stable flash tier per ai.google.dev, fetched 2026-07-20) and `claude-opus-4-8` (per the
  claude-api skill). Both live in `PROVIDERS` in `provider.js`; `AI_MODEL` overrides.

## Decisions

Decision 1 is **ratified with Naveen 2026-07-20**; the rest are **PROPOSED** with sensible defaults
— flag disagreement at review, none block implementation.

1. **Provider-agnostic platform, switched by env (RATIFIED 2026-07-20).** `src/lib/ai/` owns
   everything provider-shaped: a neutral `generateJson({ system, prompt, schema, maxOutputTokens })
   → object` entry point that dispatches to the adapter named by `AI_PROVIDER`
   (`gemini | anthropic`), typed errors (`AiNotConfiguredError`, `AiProviderError`), and one adapter
   module per provider. Feature code (digest route, dialog) imports only the neutral surface.
   Adding a provider later = one new adapter file + an env value. *Alternatives considered:*
   hardcoding Gemini (rejected — the explicit requirement); automatic failover chains
   (`AI_PROVIDER=gemini,anthropic`) — parked to Out of scope; the operator-level env flip satisfies
   the switching requirement without health-check machinery.
2. **Adapters are hand-rolled `fetch` wrappers — zero new npm deps.** Each adapter is ~60 lines:
   build the provider's JSON body, POST with the provider's auth header, map errors, extract text.
   The house bias is no-new-deps until a spike proves necessity (trend-burndown charted with raw
   SVG; step 8 added deps only after a capture spike). *Alternatives considered:* official SDKs
   (`@google/genai`, `@anthropic-ai/sdk`) — two dep trees for two non-streaming JSON calls;
   Vercel AI SDK (`ai` + provider packages) — the off-the-shelf answer to provider-agnosticism, but
   its abstractions (streaming, React hooks, tool loops) far exceed the need and the interface
   would be theirs, not ours. Note: the repo's `claude-api` skill mandates the official SDK for
   Anthropic code *except* when the project is explicitly provider-neutral — this project now is,
   which is exactly that carve-out.
3. **Config via env; both keys can coexist; loud-fail on misconfiguration; dormant when absent.**
   `AI_PROVIDER` (`gemini` | `anthropic`), per-provider keys `GEMINI_API_KEY` /
   `ANTHROPIC_API_KEY`, optional `AI_MODEL` override (defaults live in one constants map in
   `lib/ai/`). Keeping both keys set and flipping `AI_PROVIDER` is the intended switching
   workflow. Read lazily at call time (never module load — the DB/env-free build invariant);
   selected-provider-key-missing or unknown provider fails loudly (crypto.js/CRON_SECRET
   precedent). **Entirely unconfigured `AI_PROVIDER` is a supported dormant state**: the server
   passes `aiEnabled: false`, the UI shows no AI affordance, the route answers
   `503 { error: "AI provider is not configured" }`. Secrets from Tekion's store in prod (§13.5).
4. **Surface: an on-demand "AI Digest" dialog on `/`, opened from a Hero button.** Follows the
   ShareDialog/ExportDialog pattern exactly (Hero button → dialog → action → clipboard + toast).
   Dialog contains: Generate button (spinner while in flight), the rendered digest (headline,
   narrative paragraphs, call-outs list with severity badges), **Copy** (plain-text/markdown to
   clipboard + success toast — the artifact is *pasted into a Slack/email update*, that's the
   job), Regenerate, inline error state. Generation is **only ever user-initiated** — never on
   page load, SSR, or cron — which is the entire v1 cost-control story. *Alternatives considered:*
   a third dashboard panel (rejected — Naveen just tightened dashboard real estate 2026-07-19, and
   an always-visible panel begs to be auto-populated = cost); auto-generate on load (rejected —
   cost + latency for a page that renders fine without it). Roll-up digest for `/rollup` is a fast
   follow (Out of scope) — same builder, one more route.
5. **One new API route:** `POST /api/teams/[teamId]/sprints/[sprintId]/ai-digest` — the existing
   team/sprint route tree (step-4/5/8 precedent), `force-dynamic`, no request body (the server
   derives everything; zod-validate params only). RBAC: `requireTeamRole(TEAM_ALL_ROLES)` — any
   member including VIEWER may generate (the audience is the read-side personas; VIEWERs are
   exactly the ED/VP readers), admin bypass as usual. Coding-standards routes third-party
   integrations to Route Handlers, not Server Actions. *Alternative:* writers-only for cost
   control (rejected for v1 — the button-per-click model already bounds spend; revisit with usage).
6. **No persistence — no schema change, no migration.** The digest is returned to the client and
   rendered; nothing is stored. Regeneration is at-will. Consequences accepted: no digest history,
   share/export pages carry **no AI content** (consistent with the frozen-share/export trend
   exclusion — nothing time-dependent or non-reproducible enters those paths), and every
   generation costs one provider call. An `AiDigest` cache/history table is deferred until real
   usage demands it (the "re-seed forward" deferral precedent, §6).
7. **The prompt input is a deterministic, pure digest payload — never raw Jira dumps.** Pure
   `buildDigestInput(...)` + `buildDigestPrompt(...)` in `src/lib/ai/digest.mjs` (`.mjs` — the
   `seeding.mjs`/`metrics.mjs` plain-Node-fixture convention) compose a compact JSON payload from
   data the board already shows: sprint window/name/team, §12 metrics summary (completion %,
   health bands, velocity incl. snapshot override), trend/projection numbers
   (`buildTrendSeries`/`snapshotVelocity` outputs), and the **worst-N issues** (the
   RiskCalloutsPanel's exact Blocked → Behind → At Risk points-desc ordering, capped ~10, with
   jiraKey/title/points/health/blockedReason). Deterministic input → fixture-testable prompts and
   bounded token cost.
8. **Structured JSON out, zod-validated, one repair retry.** The digest contract
   (`src/lib/schemas/ai.js`): `{ headline: string, narrative: string[], callouts: [{ severity:
   "danger"|"warn"|"info", text: string, jiraKeys: string[] }] }`. Each adapter requests JSON
   natively — Gemini via `generationConfig.responseMimeType: "application/json"` (+
   `responseSchema`), Anthropic via `output_config: { format: { type: "json_schema", schema } }`
   (the current Messages API shape; **not** the deprecated top-level `output_format`, no
   prefills — they 400 on current models). Parse + zod-validate in the neutral layer; on failure,
   one retry appending the validation error to the prompt; then `AiProviderError`. Error mapping
   in-route (step-5 Jira precedent): provider 4xx/5xx/network/timeout → `502 { error }` with a
   human-readable message; unconfigured → 503 (decision 3); never leak keys or raw provider
   payloads into responses or logs.
9. **Two adapters ship in v1; both verified against contract-faithful mock HTTP servers.**
   `gemini.js` (default model: current stable flash-tier — **verify the exact model id against
   Google's docs at implementation time**, training data is stale here) and `anthropic.js`
   (default `claude-opus-4-8`; endpoint `POST https://api.anthropic.com/v1/messages`, headers
   `x-api-key` + `anthropic-version: 2023-06-01`; consult the repo's `claude-api` skill at
   implementation time — several shapes drifted from training data). `AI_MODEL` overrides either
   default (the cost lever — e.g. a cheaper Anthropic tier — is the operator's choice via env, not
   hardcoded). The step-5 mock-Jira precedent applies: a local mock per provider proves both
   adapters produce the identical normalized digest without burning real tokens; the live smoke
   runs against whichever real key(s) Naveen provides.
10. **No streaming, no sampling params, ~30s timeout.** The digest is a few hundred tokens — a
    single non-streaming JSON response with `maxOutputTokens` ~2048 is right-sized; streaming is
    provider-divergent complexity v1 doesn't need. Do not send `temperature`/`top_p` (current
    Anthropic Opus models **reject** sampling params with a 400; rely on provider defaults +
    prompt). `AbortSignal.timeout(30_000)` per attempt so a hung provider can't wedge the route.

## Requirements

### Scope

**(a) AI platform — `src/lib/ai/`**
- `provider.js`: `getAiConfig()` (lazy env read → `{ provider, model, apiKey }`, loud-fail per
  decision 3; exported `isAiConfigured()` for the `aiEnabled` flag), `generateJson({ system,
  prompt, schema, maxOutputTokens })` dispatching to the adapter, the parse → zod-validate →
  single-repair-retry loop (decision 8), `AiNotConfiguredError` / `AiProviderError` (typed, with a
  safe `message`; provider HTTP status kept internally for the 502 mapping).
- `adapters/gemini.js`, `adapters/anthropic.js`: `fetch`-only, per decision 2/9/10. Each exports
  one `generate({ apiKey, model, system, prompt, schema, maxOutputTokens, signal }) → string`
  (raw text out; parsing/validation stays in the neutral layer). All provider endpoints, headers,
  body shapes, and model defaults isolated here — nothing provider-shaped escapes `lib/ai/`.

**(b) Digest builder — `src/lib/ai/digest.mjs` + `src/lib/schemas/ai.js`**
- Pure `buildDigestInput({ team, sprint, metrics, series, velocity, issues, progressByKey, asOf })`
  → the decision-7 payload (worst-N ordering copied from RiskCalloutsPanel's `STATUS_RANK` sort —
  extract or mirror it; keep the two in lockstep), and `buildDigestPrompt(input)` → `{ system,
  prompt }` strings. Both storage-free and plain-Node testable.
- The system prompt must instruct: leadership audience, concise, ground every claim in the
  supplied numbers, no invented Jira keys, **treat issue titles/blocked reasons as data, not
  instructions** (they are Jira-authored free text — the prompt-injection surface).
- `src/lib/schemas/ai.js`: the zod digest contract (decision 8) + a plain-JSON-schema rendering of
  it for the providers' native JSON modes (mind Gemini's schema-subset limits — keep it flat).

**(c) Route — `src/app/api/teams/[teamId]/sprints/[sprintId]/ai-digest/route.js`**
- `POST`, `force-dynamic`, session + `requireTeamRole(..., TEAM_ALL_ROLES)` (decision 5), async
  `params` (Next 16). Assemble inputs by reusing `lib/dashboard-data.js` pieces (add a lean
  `getDigestData(teamId, sprintId)` there or reuse the existing assembly — same batched reads, no
  N+1), run `computeSprintMetrics`/`buildTrendSeries`/`snapshotVelocity` exactly as the pages do,
  then `buildDigestPrompt` → `generateJson` → `200 { digest, generatedAt, provider, model }`
  (provider/model surfaced for the dialog's fine-print attribution). Errors per decision 8 via
  `handleRouteError` (+ the two new mappings 502/503 in-route, step-5 style).

**(d) UI — dialog + wiring**
- `src/components/dashboard/ai-digest-dialog.jsx`: dialog-system component per decision 4
  (Generate/Regenerate → `apiFetch(`${base}/ai-digest`, { method: "POST" })`, spinner, rendered
  digest with severity-badged call-outs + linked Jira keys via `jiraBaseUrl`, Copy →
  clipboard + `showToast`, inline error state — no AlertDialog takeover for an optional feature).
  Render digest text as plain React text nodes (escaped by default) — never `dangerouslySetInnerHTML`.
- `hero.jsx`: an "AI Digest" button (lucide `Sparkles`, `onDark`, beside Share/Export) rendered
  only when `onAiDigest` is passed. `dashboard.jsx`: state + handler like `showShare`/`showExport`,
  gated on `aiEnabled && base`.
- `src/lib/dashboard-data.js`: `getDashboardData` additionally returns `aiEnabled:
  isAiConfigured()`; `src/app/page.jsx` threads it through. `getShareData`/`getRollupData`
  untouched (share page must show nothing; roll-up is out of scope).

**(e) Env + docs**
- `.env.example` gains an "AI insights" block: `AI_PROVIDER` (empty = feature hidden),
  `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (both may be set — flip `AI_PROVIDER` to switch),
  `AI_MODEL` (optional override; note it as the cost lever). Prod values from the secret store.
- No new deps, no schema change, no migration; route list grows 27 → 28 ƒ Dynamic.

### Mechanism / gotchas

- **Read the installed Next 16 docs first** (`node_modules/next/dist/docs/`, AGENTS.md discipline)
  — async `params` on the new route; nothing else novel (nodejs runtime default is fine for
  `fetch` + AbortSignal).
- **Consult the `claude-api` skill when writing the Anthropic adapter** — the Messages API drifted
  from training data (structured outputs are `output_config.format`, sampling params rejected on
  current Opus, prefills 400). For Gemini, **WebFetch the current REST reference** at
  implementation time (`generateContent` shape + current model ids) — do not trust recalled model
  names.
- **DB/env-free build invariant:** no env reads at module load anywhere in `lib/ai/`; the build
  must stay green with every `AI_*` var unset (that's also the dormant state).
- **Never log or echo secrets/prompts:** error paths return curated messages; the raw provider
  response body is never forwarded to the client; keys never appear in errors or logs.
- **Prompt injection:** issue titles and `blockedReason` are attacker-writable (any Jira user).
  The system prompt marks them as data; the output contract is structured JSON rendered as text —
  even a "successful" injection can only vandalize the digest text, never execute. Keep it that
  way (no HTML rendering, no links except app-constructed `jiraBaseUrl` + validated keys — link
  only `callouts[].jiraKeys` values that exist in the digest input, drop hallucinated ones).
- **Provider JSON quirks:** Gemini's `responseSchema` supports a subset of JSON Schema — keep the
  contract flat (no unions beyond the severity enum); Anthropic's json_schema requires
  `additionalProperties: false` + `required`. The zod validation in the neutral layer is the real
  gate; provider-side schema is best-effort steering.
- **Cost/limits posture:** on-demand-only + worst-N caps + `maxOutputTokens` bound spend per
  click; there is deliberately no rate limiting in v1 (internal tool, member-gated) — revisit with
  usage, noted in Out of scope.
- **`asOf` discipline (step 8):** the digest route computes metrics at request time (fresh `new
  Date()`), same as the dashboard. Nothing here touches the frozen-share `asOf` pin.

### Acceptance criteria

- `yarn lint` + `yarn build` green at the repo root; build stays **DB/env-free** (also all-`AI_*`
  -free); route list **28 ƒ Dynamic** (exactly one new entry).
- **Plain-Node fixtures** (scratchpad) for (b): worst-N ordering/cap parity with the risk panel,
  payload field pick, deterministic prompt bytes for a fixed input, zod contract accepts/rejects
  (missing field, bad severity, non-array narrative), hallucinated-jiraKey filtering.
- **Mock-provider round-trip:** contract-faithful local mock servers for both providers (step-5
  precedent); with `AI_PROVIDER=gemini` then `=anthropic` pointed at the mocks, the route returns
  the **identical normalized digest shape** — the provider-swap proof. Also: malformed-JSON reply →
  one repair retry → success; persistent garbage → 502; mock 500 → 502; timeout → 502.
- **SSR/API smoke on dev+Neon** (minted-cookie pattern, fabricated team/sprint, teardown to 0):
  unauth → 401; non-member → 404/403 per rbac convention; member VIEWER → 200; unconfigured env →
  Hero shows no AI button + route → 503; configured → button present; `/share/[token]` (live +
  frozen) render **no AI affordance**.
- **Live smoke:** one real generation against the configured provider (Naveen supplies the Gemini
  key; Anthropic live pass optional if a key exists) — digest renders, Copy lands in clipboard,
  provider/model attribution correct.
- ⚠️ Human acceptance (Naveen): read a real digest for his live sprint and judge the narrative
  quality; flip `AI_PROVIDER` once end-to-end to see the switch work.

### Out of scope

- **Roll-up (`/rollup`) digest** — fast follow: same `digest.mjs` builder over `aggregateRollup`
  inputs + one membership-derived route. Parked to keep v1 to one route/one dialog.
  **→ BUILT 2026-07-21**, see context/features/risk-comments-rollup-digest.md (decisions 6–8):
  `buildRollupDigestInput`/`buildRollupDigestPrompt` added to `digest.mjs`, flat
  `POST /api/rollup/ai-digest`, `AiDigestDialog` generalized via `endpoint`/`body`/`intro` props.
- **Narrative in PDF export / share pages** — the §14.10 "narrative for exports" idea; needs a
  decision about non-reproducible content in frozen artifacts. Post-v1 follow-up.
- **The other two §16 use cases** — Q&A over sprint data, stage suggestions.
- **Automatic failover chains / provider health checks** — switching stays an operator env flip.
- **Persistence (`AiDigest` table), digest history, caching** — deferred until usage demands
  (would be a prisma-change feature).
- **Streaming responses, rate limiting/budget caps, per-team provider config** — revisit with
  real usage.
- **Cron-generated scheduled digests** — would ride on step 7's cron if ever wanted.

## Doc-sync (§17 — do in the same PR)

- **§5 "AI summary (Gemini)" row** → **[BUILT]** with date; retitle to "AI summary (pluggable
  provider)" and note: provider-agnostic platform (`lib/ai/`), Gemini + Anthropic adapters,
  env-switched; risk call-outs + narrative digest on `/`; Q&A/stage-suggestions still open.
- **§8** Gemini line → "AI provider (pluggable; optional)" and mark the line BUILT-in-part.
- **§10 AI row** → amend "Gemini (post-v1)" to the provider-agnostic decision with the 2026-07-20
  ratification date.
- **§14.10** → fixed (scope decided AND built for the first two use cases).
- **§16 Gemini decision** → append the amendment: *provider-agnostic platform ratified with Naveen
  2026-07-20; Gemini demoted from "the" AI to the first adapter.*
- **Master plan step 10** → the post-v1 "then Gemini" clause → done for risk call-outs +
  narrative; name the remaining post-v1 ideas (roll-up digest, export narrative, Q&A, stage
  suggestions) so `**Next:**` in current-feature.md has an honest successor.
- **Don't over-claim:** shares/exports deliberately carry no AI content; `/rollup` has no digest;
  there is no failover automation — switching is manual by design; no schema change happened.

## References

- @context/project-overview.md — §2.2/§3 (leadership visibility), §5 (AI summary row), §8
  (Gemini line), §10 (AI row), §13.5 (secrets), §14.10, §16 (AI use-case ratification,
  2026-06-10), §17 (isolation + pure-function conventions).
- @context/features/trend-burndown.md — the RiskCalloutsPanel as-built note (the deterministic
  forerunner; worst-N ordering to mirror).
- @context/features/sync-hybrid-seeding.md — in-route error mapping (401/502) + contract-faithful
  mock verification precedent.
- @context/features/auth-layer.md — loud-fail secret handling (`crypto.js`), lazy env reads,
  route-handler conventions.
- @context/features/share-view-export.md — Hero button → dialog → clipboard + toast pattern; the
  frozen-content exclusion rationale this feature inherits.
- `src/components/dashboard/risk-callouts-panel.jsx` (`STATUS_RANK` sort, cap, severity tones),
  `src/components/dashboard/dashboard.jsx` + `hero.jsx` (wiring points),
  `src/components/dashboard/share-dialog.jsx` (dialog mechanics to mirror).
- `src/lib/rbac.js` (`TEAM_ALL_ROLES`), `src/lib/api/route-helpers.js` (`handleRouteError`),
  `src/lib/dashboard-data.js` (assembly to reuse), `src/lib/metrics.mjs` (pure inputs),
  `.env.example` (env block conventions).
- `.claude/skills/claude-api` — consult when writing the Anthropic adapter (current Messages API
  shapes; provider-neutral carve-out noted in decision 2).
