#!/usr/bin/env node
/**
 * StoryBoard Connector — runs StoryBoard's "Analyse with Claude" jobs on YOUR machine, with YOUR
 * Claude Code (company subscription) and your signed-in ORBIT DeepContext tools.
 *
 *   node connector.mjs login <storyboard-url> <token>   pair with StoryBoard (token from Settings)
 *   node connector.mjs start                            run until Ctrl-C
 *   node connector.mjs status                           show the saved pairing
 *   node connector.mjs logout                           forget the pairing
 *
 * How it works: it long-polls StoryBoard for jobs YOU requested, runs `claude -p` headless for each
 * one in an empty working directory, streams short progress lines back, and posts the structured
 * result. Nothing on your machine is read or changed: Claude runs with NO built-in tools (no shell,
 * no files, no web) and may only call the read-only ORBIT DeepContext / estimate tools below —
 * this ceiling is enforced here, whatever the server asks for.
 *
 * Zero dependencies; Node >= 18. Source: claude-connector-analysis.md in the StoryBoard repo.
 */
import { spawn, execFile } from "node:child_process";
import { mkdir, readFile, writeFile, rm, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const VERSION = "1.0.0";
const HOME_DIR = join(homedir(), ".storyboard");
const CONFIG_PATH = join(HOME_DIR, "connector.json");
const WORK_DIR = join(HOME_DIR, "work");

/** Local safety ceiling — only read-only ORBIT tools, whatever the server sends. */
const TOOL_CEILING = /^mcp__plugin_orbit_orbit-(deepcontext|estimate)__[a-z_]+$/;
const SAFE_NAME = /^[\w.\-[\]]{1,64}$/;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const MAX_TIMEOUT_MINUTES = 60;
const PROGRESS_THROTTLE_MS = 2000;

const log = (message) => console.log(`${new Date().toLocaleTimeString()}  ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function saveConfig(config) {
  await mkdir(HOME_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600);
}

function claudeVersion() {
  return new Promise((resolve) => {
    execFile("claude", ["--version"], { timeout: 15000 }, (error, stdout) => {
      resolve(error ? null : stdout.trim().split("\n")[0]);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// StoryBoard API
// ─────────────────────────────────────────────────────────────

function api(config, claude) {
  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    "x-storyboard-connector-version": VERSION,
    ...(claude ? { "x-claude-version": claude } : {}),
  };
  return {
    async next() {
      const res = await fetch(`${config.url}/api/connector/jobs/next`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(45000),
      });
      if (res.status === 204) return null;
      if (res.status === 401) throw Object.assign(new Error("unauthorized"), { fatal: true });
      if (!res.ok) throw new Error(`StoryBoard answered ${res.status}`);
      return res.json();
    },
    async event(jobId, body) {
      const res = await fetch(`${config.url}/api/connector/jobs/${encodeURIComponent(jobId)}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok && body.type !== "progress") {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `StoryBoard answered ${res.status}`);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Running one job
// ─────────────────────────────────────────────────────────────

/** Turn a stream-json tool_use into a short human line for the StoryBoard dialog. */
function describeToolUse(name, input) {
  const tool = name.replace(/^mcp__plugin_orbit_orbit-(deepcontext|estimate)__/, "");
  const query = input?.query ?? input?.queries?.[0]?.query ?? input?.jql ?? input?.topic ?? "";
  const labels = {
    get_deep_context_instructions: "Reading DeepContext instructions",
    get_jira_issues: "Reading the Jira ticket",
    search: "Searching DeepContext",
    batch_search: "Searching DeepContext",
    query_knowledge_graph: "Querying the code knowledge graph",
    get_document_chunks: "Reading source documents",
    search_toc_tickets: "Searching support tickets",
    get_toc_similar_tickets: "Finding similar support tickets",
    predict_jira: "Estimating size with ORBIT PACE",
  };
  const label = labels[tool] ?? `Using ${tool.replace(/_/g, " ")}`;
  const detail = typeof query === "string" && query ? `: ${query.slice(0, 80)}` : "";
  return `${label}${detail}…`;
}

function buildArgs(job) {
  const tools = (job.allowedTools ?? []).filter((tool) => TOOL_CEILING.test(tool));
  if (tools.length === 0) throw new Error("No permitted tools in the job");
  if (!SAFE_NAME.test(job.model)) throw new Error("Invalid model name");
  const effort = EFFORTS.includes(job.effort) ? job.effort : "medium";
  const budget = Math.min(Math.max(Number(job.maxBudgetUsd) || 1, 0.1), 50);
  return [
    "-p",
    job.prompt,
    "--append-system-prompt",
    job.appendSystemPrompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--json-schema",
    JSON.stringify(job.jsonSchema),
    "--model",
    job.model,
    "--effort",
    effort,
    "--max-budget-usd",
    String(budget),
    // No built-in tools at all: no shell, no file access, no web.
    "--tools",
    "",
    "--allowedTools",
    tools.join(","),
    "--permission-mode",
    "dontAsk",
    // Keep the per-turn context small: the user's other skills/plugins aren't needed (spike note 5).
    "--disable-slash-commands",
    "--exclude-dynamic-system-prompt-sections",
    "--no-session-persistence",
  ];
}

function runClaude(job, onProgress) {
  const timeoutMinutes = Math.min(Math.max(Number(job.timeoutMinutes) || 10, 1), MAX_TIMEOUT_MINUTES);
  return new Promise((resolve, reject) => {
    const child = spawn("claude", buildArgs(job), {
      cwd: WORK_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
    });
    let buffer = "";
    let stderr = "";
    let result = null;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out after ${timeoutMinutes} minutes`));
    }, timeoutMinutes * 60_000);

    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === "assistant") {
          for (const block of event.message?.content ?? []) {
            if (block.type === "tool_use" && block.name !== "StructuredOutput") {
              onProgress(describeToolUse(block.name, block.input));
            }
          }
        } else if (event.type === "result") {
          result = event;
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error.code === "ENOENT" ? new Error("`claude` is not on PATH") : error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (result?.subtype === "success" && result.structured_output) {
        resolve(result);
      } else if (result?.subtype === "error_max_budget_usd") {
        reject(new Error("Stopped at the per-analysis budget cap — ask an admin to raise it"));
      } else if (result) {
        reject(new Error(`Claude Code ended with "${result.subtype}"${result.errors?.[0] ? `: ${result.errors[0]}` : ""}`));
      } else {
        reject(new Error(`Claude Code exited (${code})${stderr ? `: ${stderr.trim().split("\n").pop()}` : ""}`));
      }
    });
  });
}

async function handleJob(client, job) {
  log(`▶ ${job.jiraKey} (${job.kind.toLowerCase()}, ${job.model})`);
  let lastSent = 0;
  let pending = null;
  const onProgress = (note) => {
    pending = note;
    const now = Date.now();
    if (now - lastSent >= PROGRESS_THROTTLE_MS) {
      lastSent = now;
      client.event(job.jobId, { type: "progress", note: pending.slice(0, 300) }).catch(() => {});
      pending = null;
    }
  };
  try {
    const result = await runClaude(job, onProgress);
    await client.event(job.jobId, {
      type: "result",
      result: result.structured_output,
      costUsd: typeof result.total_cost_usd === "number" ? result.total_cost_usd : null,
      durationMs: typeof result.duration_ms === "number" ? Math.round(result.duration_ms) : null,
    });
    log(`✔ ${job.jiraKey} saved${typeof result.total_cost_usd === "number" ? ` ($${result.total_cost_usd.toFixed(2)})` : ""}`);
  } catch (error) {
    log(`✖ ${job.jiraKey}: ${error.message}`);
    await client.event(job.jobId, { type: "error", message: error.message.slice(0, 1000) }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────

async function login(url, token) {
  if (!url || !token) throw new Error("Usage: node connector.mjs login <storyboard-url> <token>");
  const base = new URL(url);
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !local) throw new Error("StoryBoard URL must be https");
  if (!/^sbc_[\w-]{16,128}$/.test(token)) throw new Error("That doesn't look like a connector token");
  await saveConfig({ url: base.origin, token });
  console.log(`Paired with ${base.origin}. Now run:  node ${process.argv[1]} start`);
}

async function start() {
  const config = await loadConfig();
  if (!config) throw new Error("Not paired yet — run the login command from StoryBoard → Settings");
  const claude = await claudeVersion();
  if (!claude) throw new Error("Claude Code (`claude`) was not found on PATH — install it and sign in first");
  await mkdir(WORK_DIR, { recursive: true });

  const client = api(config, claude);
  log(`StoryBoard Connector ${VERSION} · ${claude} · ${config.url}`);
  log("Waiting for analyses… (Ctrl-C to stop)");

  let backoff = 2000;
  for (;;) {
    try {
      const job = await client.next();
      backoff = 2000;
      if (job) await handleJob(client, job);
    } catch (error) {
      if (error.fatal) throw new Error("StoryBoard rejected the token — generate a new one in Settings and log in again");
      log(`Can't reach StoryBoard (${error.message}); retrying in ${Math.round(backoff / 1000)}s`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 60000);
    }
  }
}

async function status() {
  const config = await loadConfig();
  console.log(config ? `Paired with ${config.url}` : "Not paired");
  console.log(`Claude Code: ${(await claudeVersion()) ?? "not found on PATH"}`);
}

async function logout() {
  await rm(CONFIG_PATH, { force: true });
  console.log("Pairing removed. (Revoke the token in StoryBoard → Settings too.)");
}

const [command, ...args] = process.argv.slice(2);
const commands = { login: () => login(...args), start, status, logout };
const run = commands[command];
if (!run) {
  console.log("Usage: node connector.mjs <login <url> <token> | start | status | logout>");
  process.exit(command ? 1 : 0);
}
run().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
