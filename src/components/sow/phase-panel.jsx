"use client";

/**
 * The rows of one SOW phase, used by its drill-in panel (sow-tracker.md (g), round 2): the
 * hand-kept plan items (milestones and non-Jira tasks, baseline → current with the slip) and the
 * Jira tickets of the kinds the phase owns — epics with their children, then the rest by kind.
 * Admins change a plan item's status in place; everything else is edited in the plan dialog.
 */
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, KIND_LABELS } from "@/lib/sow/defaults.mjs";
import { formatDay } from "@/lib/sow/timeline.mjs";
import { GateMark, IssueKeyLink, ItemStatusChip, PlanDates, pctLabel, relativeDays } from "./sow-kit";
import { EpicRow, TicketList } from "./ticket-list";

export function timingLine(phase) {
  if (phase.state === "done") return `Ended ${formatDay(phase.endDate)}`;
  if (phase.state === "active") return phase.daysToEnd === 0 ? "Ends today" : `Ends ${relativeDays(phase.daysToEnd)}`;
  return `Starts ${relativeDays(phase.daysToStart)}`;
}

export function PlanItemRow({ item, jiraBaseUrl, canEdit, busy, onStatusChange }) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <div className="w-32 shrink-0">
        {canEdit ? (
          <Select
            size="sm"
            value={item.status}
            onChange={(event) => onStatusChange(item.id, event.target.value)}
            disabled={busy}
            aria-label={`Status of ${item.title}`}
          >
            {ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ITEM_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        ) : (
          <ItemStatusChip status={item.status} />
        )}
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <p className={cn("flex min-w-0 items-center gap-1.5 text-sm", item.isGate ? "font-semibold" : "font-medium")}>
          {item.isGate && <GateMark />}
          <span className="truncate" title={item.title}>{item.title}</span>
          {item.linked && (
            <span className="flex shrink-0 items-center gap-1.5">
              <IssueKeyLink jiraBaseUrl={jiraBaseUrl} issueKey={item.linked.key} />
              <span className="text-xs font-bold tabular-nums">{pctLabel(item.linked.pct)}</span>
            </span>
          )}
        </p>
        {item.comment && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.comment}>{item.comment}</p>}
      </div>
      <PlanDates item={item} className="shrink-0" />
    </li>
  );
}

export function TicketGroups({ phase, view }) {
  const { issues, jiraBaseUrl, progress } = view;
  const kinds = phase.kinds.filter((kind) => kind !== "EPIC");
  const showEpics = phase.kinds.includes("EPIC") && progress.epics.length > 0;
  const mine = issues.filter((issue) => kinds.includes(issue.kind));
  const loose = showEpics ? mine.filter((issue) => !issue.epicKey) : mine;
  const looseKinds = kinds.filter((kind) => loose.some((issue) => issue.kind === kind));

  if (!showEpics && mine.length === 0) {
    const names = phase.kinds.map((kind) => KIND_LABELS[kind].toLowerCase()).join(", ");
    return <p className="text-sm text-muted-foreground">No {names} yet — they will appear here once they match the Jira filter of this SOW.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {showEpics && (
        <ul className="flex flex-col gap-2">
          {progress.epics.map((epic) => (
            <EpicRow key={epic.key} epic={epic} jiraBaseUrl={jiraBaseUrl} tickets={issues.filter((issue) => issue.epicKey === epic.key)} />
          ))}
        </ul>
      )}
      {looseKinds.map((kind) => {
        const members = loose.filter((issue) => issue.kind === kind);
        const open = members.filter((issue) => issue.state !== "done").length;
        return (
          <div key={kind}>
            <h4 className="flex items-baseline gap-2 text-xs font-bold tracking-wide text-secondary-foreground uppercase">
              {showEpics ? `${KIND_LABELS[kind]} under no epic` : KIND_LABELS[kind]}
              <span className="font-medium tracking-normal text-muted-foreground normal-case tabular-nums">
                {open} open / {members.length}
              </span>
            </h4>
            <TicketList issues={members} jiraBaseUrl={jiraBaseUrl} />
          </div>
        );
      })}
    </div>
  );
}
