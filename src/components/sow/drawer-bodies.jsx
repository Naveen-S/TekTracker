"use client";

/**
 * What the SOW drill-in panel shows for each thing you can open on the overview (sow-tracker.md
 * round 2): a phase, an epic, one ticket, an issue stage (the pre-QA Slack list is triaged here),
 * a person, risks, dependencies, the decision log and the reading list. Each returns `{ eyebrow, title, subtitle,
 * body }` for SowDrawer, or null when its target no longer exists.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Eye, EyeOff, Film, FolderGit2, Hash, ImageIcon, Link2, MessageSquare, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { KIND_LABELS, KIND_SHORT, RISK_STATUS_LABELS, RISK_TYPE_LABELS } from "@/lib/sow/defaults.mjs";
import { SLACK_OVERRIDES, SLACK_OVERRIDE_LABELS, SLACK_STATUS_LABELS } from "@/lib/sow/slack.mjs";
import { formatDay } from "@/lib/sow/timeline.mjs";
import { PlanItemRow, TicketGroups, timingLine } from "./phase-panel";
import { DETAIL_LABELS, StateSquare } from "./scope-map";
import { IssueKeyLink, JiraKeysLink, JiraStatusChip, KindTag, ProgressBar, StackBar, pctLabel } from "./sow-kit";
import { TicketList } from "./ticket-list";

const SectionTitle = ({ children }) => <h3 className="mb-1 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{children}</h3>;

/** Ticket rows that open the ticket panel instead of leaving for Jira. */
function TicketRows({ issues, jiraBaseUrl, onOpenTicket, emptyLabel = "Nothing here." }) {
  if (issues.length === 0) return <p className="py-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="divide-y">
      {issues.map((issue) => (
        <li key={issue.key} className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 py-2">
          <StateSquare detail={issue.detail} dependency={issue.isDependency} />
          <IssueKeyLink jiraBaseUrl={jiraBaseUrl} issueKey={issue.key} className="shrink-0" />
          <button type="button" onClick={() => onOpenTicket(issue.key)} className="min-w-0 flex-1 basis-56 truncate rounded text-left text-sm outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50" title={issue.summary}>
            {issue.summary}
          </button>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="hidden text-xs text-muted-foreground sm:inline">{issue.assigneeName ?? "Unassigned"}</span>
            <JiraStatusChip status={issue.status} state={issue.state} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const ORDER = { inReview: 0, inProgress: 1, todo: 2, done: 3 };
const openFirst = (issues) => [...issues].sort((a, b) => ORDER[a.detail] - ORDER[b.detail] || a.key.localeCompare(b.key, undefined, { numeric: true }));

function phasePanel(view, id, ctx) {
  const phase = view.phases.find((entry) => entry.id === id);
  if (!phase) return null;
  const done = phase.items.filter((item) => item.status === "DONE").length;
  return {
    eyebrow: `Phase ${view.phases.indexOf(phase) + 1} of ${view.phases.length}`,
    title: phase.name,
    subtitle: `${formatDay(phase.startDate)} – ${formatDay(phase.endDate, { year: true })} · ${timingLine(phase)}${phase.items.length ? ` · ${done}/${phase.items.length} plan items done` : ""}`,
    body: (
      <div className="flex flex-col gap-5">
        {phase.kinds.length > 0 && phase.progress.total > 0 && (
          <div className="flex items-center gap-3">
            <ProgressBar pct={phase.progress.pct} className="flex-1" />
            <span className="text-sm font-bold tabular-nums">{pctLabel(phase.progress.pct)}</span>
          </div>
        )}
        {phase.items.length > 0 && (
          <div>
            <SectionTitle>Plan</SectionTitle>
            <ul className="divide-y">
              {phase.items.map((item) => (
                <PlanItemRow key={item.id} item={item} jiraBaseUrl={view.jiraBaseUrl} canEdit={ctx.canEdit} busy={ctx.busy} onStatusChange={ctx.onStatusChange} />
              ))}
            </ul>
          </div>
        )}
        {phase.kinds.length > 0 && (
          <div>
            <SectionTitle>Tickets</SectionTitle>
            <TicketGroups phase={phase} view={view} />
          </div>
        )}
        {phase.items.length === 0 && phase.kinds.length === 0 && <p className="text-sm text-muted-foreground">Nothing planned in this phase yet.</p>}
      </div>
    ),
  };
}

function epicPanel(view, key, ctx) {
  const epic = view.progress.epics.find((entry) => entry.key === key);
  if (!epic) return null;
  const tickets = view.issues.filter((issue) => issue.epicKey === key);
  return {
    eyebrow: "Epic",
    title: epic.summary,
    subtitle: (
      <span className="flex flex-wrap items-center gap-x-2">
        <IssueKeyLink jiraBaseUrl={view.jiraBaseUrl} issueKey={epic.key} />
        <span>{epic.status} · {epic.assigneeName ?? "No owner"}</span>
      </span>
    ),
    body: (
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-3">
            <ProgressBar pct={epic.pct} className="flex-1" />
            <span className="font-display text-xl font-extrabold tabular-nums">{pctLabel(epic.pct)}</span>
          </div>
          <StackBar done={epic.done} inProgress={epic.inProgress} total={epic.total} className="mt-2" />
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{epic.done} done · {epic.inProgress} in progress · {epic.todo} not started · weighted by ticket kind</p>
        </div>
        <div>
          <SectionTitle>Tickets ({tickets.length})</SectionTitle>
          <TicketRows issues={openFirst(tickets)} jiraBaseUrl={view.jiraBaseUrl} onOpenTicket={ctx.open.ticket} emptyLabel="No tickets under this epic yet." />
        </div>
        <JiraKeysLink jiraBaseUrl={view.jiraBaseUrl} keys={[epic.key, ...tickets.map((issue) => issue.key)]}>Open these in Jira</JiraKeysLink>
      </div>
    ),
  };
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

function ticketPanel(view, key, ctx) {
  const issue = view.issues.find((entry) => entry.key === key);
  if (!issue) return null;
  const epic = issue.epicKey ? view.progress.epics.find((entry) => entry.key === issue.epicKey) : null;
  const children = view.issues.filter((entry) => entry.epicKey === key);
  const slack = (view.slack.posts ?? []).filter((post) => post.jiraKeys.includes(key));
  return {
    eyebrow: KIND_SHORT[issue.kind],
    title: issue.summary,
    subtitle: (
      <span className="flex flex-wrap items-center gap-2">
        <IssueKeyLink jiraBaseUrl={view.jiraBaseUrl} issueKey={issue.key} />
        <JiraStatusChip status={issue.status} state={issue.state} />
        {issue.isDependency && <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn-strong uppercase">Owned by {issue.projectKey}</span>}
      </span>
    ),
    body: (
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Fact label="State">{DETAIL_LABELS[issue.detail]}</Fact>
          <Fact label="Assignee">{issue.assigneeName ?? "Unassigned"}</Fact>
          <Fact label="Priority">{issue.priority ?? "—"}</Fact>
          <Fact label="Story points">{issue.storyPoints ?? "—"}</Fact>
          <Fact label="Fix version">{issue.fixVersions.join(", ") || "—"}</Fact>
          <Fact label="Counts for">{issue.kind === "EPIC" ? "Rolls up" : `${Math.round(issue.credit * 100)}% credit × ${view.progress.weights[issue.kind] ?? 0}`}</Fact>
          <Fact label="Created">{formatDay(issue.createdDay, { year: true })}</Fact>
          <Fact label="Resolved">{formatDay(issue.resolvedDay, { year: true })}</Fact>
          <Fact label="Due">{formatDay(issue.dueDate, { year: true })}</Fact>
        </dl>
        {epic && (
          <div>
            <SectionTitle>Epic</SectionTitle>
            <button type="button" onClick={() => ctx.open.epic(epic.key)} className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left outline-none hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span className="font-mono text-xs font-semibold text-primary">{epic.key}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{epic.summary}</span>
              <span className="text-sm font-bold tabular-nums">{pctLabel(epic.pct)}</span>
            </button>
          </div>
        )}
        {children.length > 0 && (
          <div>
            <SectionTitle>Tickets under it ({children.length})</SectionTitle>
            <TicketRows issues={openFirst(children)} jiraBaseUrl={view.jiraBaseUrl} onOpenTicket={ctx.open.ticket} />
          </div>
        )}
        {slack.length > 0 && (
          <div>
            <SectionTitle>Pre-QA issues that mention it</SectionTitle>
            <ul className="divide-y">
              {slack.map((post) => (
                <li key={post.id} className="py-2 text-sm">{post.title} <span className="text-xs text-muted-foreground">· {post.authorName} · {SLACK_STATUS_LABELS[post.status]}</span></li>
              ))}
            </ul>
          </div>
        )}
        {view.jiraBaseUrl && (
          <Button asChild variant="outline" size="sm" className="self-start">
            <a href={`${view.jiraBaseUrl}/browse/${issue.key}`} target="_blank" rel="noopener noreferrer">
              Open in Jira <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
    ),
  };
}

const SLACK_TONE = {
  NEW: "bg-danger-soft text-danger-strong",
  ACKNOWLEDGED: "bg-warn-soft text-warn-strong",
  FIXED: "bg-success-soft text-success-strong",
  NOT_ISSUE: "bg-muted text-secondary-foreground",
};
const AUTOMATIC = "";

const FILE_ICON = { IMAGE: ImageIcon, VIDEO: Film, OTHER: Paperclip };

/** A post's attachments: what Claude saw in each screenshot, and a way to open the file in Slack. */
function Attachments({ files }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {files.map((file) => {
        const Icon = FILE_ICON[file.kind] ?? Paperclip;
        return (
          <li key={file.id} className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-relaxed text-foreground">
                {file.description ?? (file.kind === "VIDEO" ? "Screen recording — open it in Slack to watch." : "Not described yet.")}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={file.name}>{file.name}</p>
            </div>
            {file.url && (
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                Open in Slack <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One pre-QA Slack issue; admins override its status and link a Jira ticket in place. */
function SlackIssueRow({ post, sowId, jiraBaseUrl, canEdit }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [jiraKey, setJiraKey] = useState(post.linkedJiraKey ?? "");
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const patch = (body) =>
    startSaving(async () => {
      setError("");
      try {
        await apiFetch(`/api/sows/${sowId}/slack-issues/${post.id}`, { method: "PATCH", body });
        router.refresh();
      } catch (caught) {
        setError(caught.message);
      }
    });

  return (
    <li className="py-3">
      <div className="flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-1.5">
        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", SLACK_TONE[post.status])}>
          {SLACK_STATUS_LABELS[post.status]}
          {post.overrideStatus && " · set by admin"}
        </span>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="min-w-0 flex-1 basis-64 rounded text-left text-sm font-medium outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {post.title}
        </button>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{post.authorName}</span>
        <span className="tabular-nums">{formatDay(post.postedDay)} · {post.ageDays === 0 ? "today" : `${post.ageDays} d ago`}</span>
        {post.replyCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" aria-hidden="true" />{post.replyCount}</span>}
        {(post.hasMedia || post.files.length > 0) && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3" aria-hidden="true" />
            {post.files.length > 0 ? `${post.files.length} ${post.files.length === 1 ? "attachment" : "attachments"}` : "media"}
          </span>
        )}
        {post.jiraKeys.map((key) => <IssueKeyLink key={key} jiraBaseUrl={jiraBaseUrl} issueKey={key} />)}
        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
            Thread <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        )}
      </p>
      {!expanded && post.files.find((file) => file.description) && (
        <p className="mt-1 line-clamp-2 text-xs text-secondary-foreground">
          <span className="font-semibold">Screenshot: </span>
          {post.files.find((file) => file.description).description}
        </p>
      )}
      {expanded && <Attachments files={post.files} />}
      {expanded && (
        <div className="mt-2 rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
          <p className="whitespace-pre-wrap">{post.text}</p>
          {post.sessionId && <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">Session {post.sessionId}</p>}
          {post.mentions.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Mentions {post.mentions.join(", ")}</p>}
        </div>
      )}
      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select size="sm" className="w-52" value={post.overrideStatus ?? AUTOMATIC} onChange={(event) => patch({ overrideStatus: event.target.value || null })} disabled={saving} aria-label={`Status of: ${post.title}`}>
            <option value={AUTOMATIC}>Automatic (reactions)</option>
            {SLACK_OVERRIDES.map((status) => (
              <option key={status} value={status}>{SLACK_OVERRIDE_LABELS[status]}</option>
            ))}
          </Select>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              patch({ linkedJiraKey: jiraKey.trim() || null });
            }}
          >
            <Input size="sm" className="w-32" value={jiraKey} onChange={(event) => setJiraKey(event.target.value)} placeholder="Jira key" aria-label="Linked Jira key" spellCheck={false} disabled={saving} />
            <Button type="submit" variant="outline" size="sm" disabled={saving || jiraKey.trim() === (post.linkedJiraKey ?? "")}>
              <Link2 aria-hidden="true" />
              Link
            </Button>
          </form>
          {error && <span className="text-xs font-medium text-danger-strong">{error}</span>}
        </div>
      )}
    </li>
  );
}

const STATUS_RANK = { NEW: 0, ACKNOWLEDGED: 1, FIXED: 2, NOT_ISSUE: 3 };

function stagePanel(view, key, ctx) {
  const stage = view.funnel.find((entry) => entry.key === key);
  if (!stage) return null;
  if (key !== "SLACK") {
    const rows = view.issues.filter((issue) => issue.kind === key);
    return {
      eyebrow: "Issue stage",
      title: KIND_LABELS[key],
      subtitle: `${stage.hint} · ${stage.open} open · ${stage.fixed} fixed of ${stage.total}`,
      body: <TicketRows issues={openFirst(rows)} jiraBaseUrl={view.jiraBaseUrl} onOpenTicket={ctx.open.ticket} emptyLabel="None raised yet. They appear here once they match this SOW's Jira source." />,
    };
  }
  const posts = [...(view.slack.posts ?? [])].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.ageDays - b.ageDays);
  const live = posts.filter((post) => post.status !== "NOT_ISSUE");
  const dismissed = posts.filter((post) => post.status === "NOT_ISSUE");
  return {
    eyebrow: "Issue stage · before the QA hand-off",
    title: `Pre-QA issues${view.slack.channelName ? ` · #${view.slack.channelName}` : ""}`,
    subtitle: !view.slack.tracked
      ? "No Slack channel is set for this SOW. An admin can add one in Settings."
      : `${stage.open} open · ${stage.fixed} fixed of ${stage.total} · Slack read ${view.slack.lastSyncedAt ? new Date(view.slack.lastSyncedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never"}`,
    body: (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
          Status follows the reactions on each post: <span className="font-semibold">:ack:</span> or <span className="font-semibold">:eyes:</span> = acknowledged, <span className="font-semibold">:white_check_mark:</span> = fixed, <span className="font-semibold">:no_entry_sign:</span> = not an issue. A linked Jira ticket that is done also counts as fixed.{ctx.canEdit ? " You can override any of them here." : ""}
        </p>
        {live.length === 0 ? (
          <p className="text-sm text-muted-foreground">{view.slack.tracked ? "No issues read from Slack yet. An admin can run Sync Slack." : "Nothing to show."}</p>
        ) : (
          <ul className="divide-y">
            {live.map((post) => <SlackIssueRow key={post.id} post={post} sowId={view.sow.id} jiraBaseUrl={view.jiraBaseUrl} canEdit={ctx.canEdit} />)}
          </ul>
        )}
        {dismissed.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Marked not an issue ({dismissed.length})</summary>
            <ul className="divide-y">
              {dismissed.map((post) => <SlackIssueRow key={post.id} post={post} sowId={view.sow.id} jiraBaseUrl={view.jiraBaseUrl} canEdit={ctx.canEdit} />)}
            </ul>
          </details>
        )}
      </div>
    ),
  };
}

function personPanel(view, name, ctx) {
  const mine = view.issues.filter((issue) => issue.kind !== "EPIC" && issue.state !== "done" && (issue.assigneeName ?? "Unassigned") === name);
  const slack = (view.slack.posts ?? []).filter((post) => (post.status === "NEW" || post.status === "ACKNOWLEDGED") && post.mentions.includes(name));
  if (mine.length === 0 && slack.length === 0) return null;
  return {
    eyebrow: name === "Unassigned" ? "Needs an owner" : "Open work",
    title: name,
    subtitle: `${mine.length} open ${mine.length === 1 ? "ticket" : "tickets"}${slack.length ? ` · mentioned in ${slack.length} pre-QA ${slack.length === 1 ? "issue" : "issues"}` : ""}`,
    body: (
      <div className="flex flex-col gap-5">
        <div>
          <SectionTitle>Tickets</SectionTitle>
          <TicketRows issues={openFirst(mine)} jiraBaseUrl={view.jiraBaseUrl} onOpenTicket={ctx.open.ticket} emptyLabel="No open tickets." />
        </div>
        {slack.length > 0 && (
          <div>
            <SectionTitle>Pre-QA issues mentioning {name}</SectionTitle>
            <ul className="divide-y">
              {slack.map((post) => <SlackIssueRow key={post.id} post={post} sowId={view.sow.id} jiraBaseUrl={view.jiraBaseUrl} canEdit={false} />)}
            </ul>
          </div>
        )}
        <JiraKeysLink jiraBaseUrl={view.jiraBaseUrl} keys={mine.map((issue) => issue.key)}>Open these in Jira</JiraKeysLink>
      </div>
    ),
  };
}

const RISK_TONE = { BLOCKER: "bg-danger-soft text-danger-strong", RISK: "bg-warn-soft text-warn-strong", DECISION: "bg-info-soft text-info-strong" };

function risksPanel(view, _id, ctx) {
  const open = view.risks.filter((risk) => risk.status === "OPEN").length;
  return {
    eyebrow: "Hand-kept",
    title: "Risks, blockers & decisions",
    subtitle: `${open} open of ${view.risks.length}`,
    footer: ctx.canEdit ? <Button variant="outline" size="sm" onClick={ctx.onEditRisks}>Edit list</Button> : null,
    body:
      view.risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="divide-y">
          {view.risks.map((risk) => (
            <li key={risk.id} className={cn("flex flex-col gap-1 py-3", risk.status === "CLOSED" && "opacity-60")}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase", RISK_TONE[risk.type])}>{RISK_TYPE_LABELS[risk.type]}</span>
                <span className="min-w-0 flex-1 basis-48 text-sm font-medium">{risk.title}</span>
                <span className="text-xs font-semibold text-secondary-foreground">{RISK_STATUS_LABELS[risk.status]}</span>
              </p>
              {(risk.note || risk.ownerName || risk.dueDate) && (
                <p className="text-xs text-muted-foreground">{[risk.ownerName, risk.dueDate && `due ${formatDay(risk.dueDate)}`, risk.note].filter(Boolean).join(" · ")}</p>
              )}
            </li>
          ))}
        </ul>
      ),
  };
}

function depsPanel(view, _id, ctx) {
  const deps = view.issues.filter((issue) => issue.isDependency);
  const projects = [...new Set(deps.map((issue) => issue.projectKey))].sort();
  return {
    eyebrow: "Owned by other teams",
    title: "Cross-team dependencies",
    subtitle: deps.length ? `${deps.filter((issue) => issue.state !== "done").length} open of ${deps.length} · ${projects.join(", ")}` : "None",
    body: <TicketRows issues={openFirst(deps)} jiraBaseUrl={view.jiraBaseUrl} onOpenTicket={ctx.open.ticket} emptyLabel="No tickets outside this SOW's own projects." />,
  };
}

function looseTicketsPanel(view, _id, ctx) {
  const rows = view.issues.filter((issue) => issue.kind !== "EPIC" && !issue.epicKey && !["INTERNAL_BUG", "UAT_ISSUE", "EXTERNAL_BUG"].includes(issue.kind));
  return { eyebrow: "Planned work", title: "Tickets under no epic", subtitle: `${rows.length} tickets`, body: <TicketList issues={rows} jiraBaseUrl={view.jiraBaseUrl} showKind /> };
}


/** Admin toggle that hides (or restores) one decision or document the extraction got wrong. */
function HideToggle({ item, sowId }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const toggle = () =>
    startSaving(async () => {
      setError("");
      try {
        await apiFetch(`/api/sows/${sowId}/feed-items/${item.id}`, { method: "PATCH", body: { hidden: !item.hidden } });
        router.refresh();
      } catch (caught) {
        setError(caught.message);
      }
    });
  const Icon = item.hidden ? Eye : EyeOff;
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={toggle} disabled={saving} className="inline-flex items-center gap-1 rounded px-1 text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50">
        <Icon className="size-3" aria-hidden="true" />
        {item.hidden ? "Restore" : "Hide"}
      </button>
      {error && <span className="text-[11px] font-medium text-danger-strong">{error}</span>}
    </span>
  );
}

function ChannelTag({ item }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <Hash className="size-3" aria-hidden="true" />
      {item.channelName ?? item.channelId}
    </span>
  );
}

/** One decision: what was decided, the context, who and when, and the message it came from. */
function DecisionRow({ item, sowId, canEdit }) {
  return (
    <li className={cn("relative py-3 pl-5", item.hidden && "opacity-60")}>
      <span className="absolute top-[18px] left-0 size-2 rounded-full bg-info ring-2 ring-card" aria-hidden="true" />
      <p className="text-sm font-semibold leading-snug">{item.title}</p>
      {item.summary && <p className="mt-0.5 text-xs leading-relaxed text-secondary-foreground">{item.summary}</p>}
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{item.authorName}</span>
        <span className="tabular-nums">{formatDay(item.postedDay, { year: true })}</span>
        <ChannelTag item={item} />
        {item.permalink && (
          <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
            Message <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        )}
        {canEdit && <HideToggle item={item} sowId={sowId} />}
      </p>
    </li>
  );
}

/** Where the feed came from, and when each channel was last read (or why it failed). */
function FeedChannels({ channels }) {
  if (channels.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {channels.map((channel) => (
        <li
          key={channel.id}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", channel.error ? "bg-danger-soft text-danger-strong" : "bg-muted text-secondary-foreground")}
          title={channel.error ?? undefined}
        >
          <Hash className="size-3" aria-hidden="true" />
          {channel.name ?? channel.id}
          <span className="font-normal opacity-80">
            · {channel.error ? "last read failed" : channel.lastSyncedAt ? `read ${formatDay(channel.lastSyncedAt.slice(0, 10))}` : "not read yet"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function decisionsPanel(view, _id, ctx) {
  const feed = view.feed;
  if (!feed) return null;
  const shown = feed.decisions.filter((item) => !item.hidden);
  const hidden = feed.decisions.filter((item) => item.hidden);
  // Grouped by month, newest first: a decision log reads as a timeline.
  const months = [];
  for (const item of shown) {
    const label = formatDay(item.postedDay, { year: true }).replace(/ \d+,/, "");
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1).items.push(item);
  }
  return {
    eyebrow: "From the docs & decisions channels",
    title: "Decision log",
    subtitle: `${shown.length} ${shown.length === 1 ? "decision" : "decisions"}, newest first. Pulled from Slack by Claude; open the message to check one.`,
    body: (
      <div className="flex flex-col gap-4">
        <FeedChannels channels={feed.channels} />
        {feed.channels.length === 0 && <p className="text-sm text-muted-foreground">No docs-and-decisions channels yet. An admin can add them in Settings.</p>}
        {feed.channels.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">No decisions read yet. An admin can run Sync Slack.</p>}
        {months.map((month) => (
          <section key={month.label}>
            <SectionTitle>{month.label}</SectionTitle>
            <ul className="relative before:absolute before:top-3 before:bottom-3 before:left-[3px] before:w-px before:bg-border">
              {month.items.map((item) => <DecisionRow key={item.id} item={item} sowId={view.sow.id} canEdit={ctx.canEdit} />)}
            </ul>
          </section>
        ))}
        {hidden.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Hidden ({hidden.length})</summary>
            <ul>{hidden.map((item) => <DecisionRow key={item.id} item={item} sowId={view.sow.id} canEdit={ctx.canEdit} />)}</ul>
          </details>
        )}
      </div>
    ),
  };
}

const REF_ICON = { CONFLUENCE: BookOpen, REPO: FolderGit2, LINK: Link2 };

/** A document someone shared in a docs-and-decisions channel. */
function SlackDocRow({ item, sowId, canEdit }) {
  return (
    <li className={cn("flex items-start gap-2.5 py-2 text-sm", item.hidden && "opacity-60")}>
      <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-primary hover:underline" title={item.url}>
          {item.title}
        </a>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
          <span>{item.authorName}</span>
          <span className="tabular-nums">{formatDay(item.postedDay, { year: true })}</span>
          <ChannelTag item={item} />
          {canEdit && <HideToggle item={item} sowId={sowId} />}
        </p>
      </div>
      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </li>
  );
}

/** Whether StoryBoard has its own copy of a primary page for Ask, and from when. */
function KnowledgeLine({ status }) {
  if (!status) return <p className="mt-0.5 text-[11px] text-muted-foreground">Not read yet — Ask uses it after the next Refresh Jira.</p>;
  if (status.error) return <p className="mt-0.5 text-[11px] font-medium text-danger-strong">Last read failed: {status.error}{status.sections ? " — Ask uses the previous copy." : ""}</p>;
  return (
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      Read for Ask {status.fetchedAt ? formatDay(status.fetchedAt.slice(0, 10)) : ""} · {status.sections} sections
    </p>
  );
}

function docsPanel(view, _id, ctx) {
  const references = view.sow.references;
  const groups = [...new Set(references.map((reference) => reference.group))];
  const slackDocs = (view.feed?.docs ?? []).filter((item) => !item.hidden);
  const hiddenDocs = (view.feed?.docs ?? []).filter((item) => item.hidden);
  return {
    eyebrow: "For anyone joining: Perf, QA, new engineers",
    title: "Docs & references",
    subtitle: `${references.length} curated${slackDocs.length ? ` · ${slackDocs.length} shared in Slack` : ""}`,
    body: (
      <div className="flex flex-col gap-5">
        {references.length === 0 && slackDocs.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents listed yet. An admin can add Confluence pages, repositories and links in Settings.</p>
        )}
        {groups.map((group) => (
          <div key={group}>
            <SectionTitle>{group}</SectionTitle>
            <ul className="divide-y">
              {references.filter((reference) => reference.group === group).map((reference) => {
                const Icon = REF_ICON[reference.kind] ?? Link2;
                return (
                  <li key={`${reference.label}-${reference.url}`} className="flex items-start gap-2.5 py-2 text-sm">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        {reference.url ? (
                          <a href={reference.url} target="_blank" rel="noopener noreferrer" className={cn("min-w-0 truncate font-medium text-primary hover:underline", reference.kind === "REPO" && "font-mono text-[13px]")}>{reference.label}</a>
                        ) : (
                          <span className="min-w-0 truncate font-mono text-[13px]">{reference.label}</span>
                        )}
                        {reference.primary && (
                          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground uppercase" title="Ask StoryBoard reads this page first">
                            Start here
                          </span>
                        )}
                      </p>
                      {reference.note && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{reference.note}</p>}
                      {reference.primary && <KnowledgeLine status={view.sow.knowledgeStatus?.find((page) => page.url === reference.url)} />}
                    </div>
                    {reference.url && <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {slackDocs.length > 0 && (
          <div>
            <SectionTitle>Shared in Slack</SectionTitle>
            <ul className="divide-y">{slackDocs.map((item) => <SlackDocRow key={item.id} item={item} sowId={view.sow.id} canEdit={ctx.canEdit} />)}</ul>
          </div>
        )}
        {hiddenDocs.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Hidden ({hiddenDocs.length})</summary>
            <ul className="divide-y">{hiddenDocs.map((item) => <SlackDocRow key={item.id} item={item} sowId={view.sow.id} canEdit={ctx.canEdit} />)}</ul>
          </details>
        )}
      </div>
    ),
  };
}

const PANELS = { decisions: decisionsPanel, phase: phasePanel, epic: epicPanel, ticket: ticketPanel, stage: stagePanel, person: personPanel, risks: risksPanel, deps: depsPanel, loose: looseTicketsPanel, docs: docsPanel };

/** `panel` is "type" or "type:id"; returns the drawer content, or null for an unknown target. */
export function resolvePanel(view, panel, ctx) {
  if (!panel) return null;
  const split = panel.indexOf(":");
  const type = split === -1 ? panel : panel.slice(0, split);
  const id = split === -1 ? null : panel.slice(split + 1);
  return PANELS[type]?.(view, id, ctx) ?? null;
}
