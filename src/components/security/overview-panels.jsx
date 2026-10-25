import { Bug, CalendarRange, Compass, Flag, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { JiraCount, SecPanel, pctTone } from "@/components/security/kit";
import { ProgressChart } from "@/components/security/progress-chart";
import { VulnDonut } from "@/components/security/vuln-donut";

/**
 * Overview panels for /security (security-vulnerability-tracker.md mapping table), styled after the
 * source artifact (Naveen 2026-10-20): program progress (full width, top), scorecard (rollup only),
 * KPI row, coverage, status by priority, vulnerability mix. Server components except the chart.
 */

/* ── Progress ──────────────────────────────────────────────────────────────── */

export function ProgressPanel({ view, jiraBaseUrl }) {
  const { progress } = view;
  const isRollup = view.program.key === "ALL";
  const scope = isRollup ? "All programs" : `${view.program.key} scope`;
  return (
    <SecPanel icon={TrendingUp} title="Overall program progress" tag={`${scope} · all triaged incl. done`}>
      <JiraCount
        jiraBaseUrl={jiraBaseUrl}
        jql={progress.jql}
        title="Open the whole progress universe in Jira"
        className="block no-underline"
      >
        <span className="block h-7 overflow-hidden rounded-full border border-sec-line bg-sec-lavender-soft">
          <span
            className="flex h-full items-center justify-end rounded-full bg-linear-to-r from-sec-blue to-sec-purple pr-3 text-xs font-extrabold text-white"
            // Width is data — the one inline style (the shared <Bar> precedent).
            style={{ width: `${Math.max(progress.pct, 12)}%` }}
          >
            {progress.pct}% remediated
          </span>
        </span>
      </JiraCount>

      <p className="mt-2.5 text-[13px] leading-relaxed text-sec-muted">
        <JiraCount jiraBaseUrl={jiraBaseUrl} jql={`(${progress.jql}) AND statusCategory = Done`} className="font-bold text-sec-ink">
          {progress.done}
        </JiraCount>{" "}
        of <strong className="text-sec-ink">{progress.total}</strong> {isRollup ? "" : `${view.program.key} `}triaged vulnerabilities
        remediated (Done) · <strong className="text-sec-pink-text">{progress.open}</strong> open ·{" "}
        <strong className="text-sec-orange-text">{progress.inProgress}</strong> in progress ·{" "}
        <strong className="text-sec-blue-text">{progress.last3}</strong> closed in {progress.months[0]} – {progress.months[2]}.
        {progress.dismissed > 0 && (
          <>
            {" "}
            <strong className="text-sec-amber-text">{progress.dismissed}</strong> of the {progress.done} Done were closed as
            not-applicable/dismissed rather than fixed (<strong className="text-sec-ink">{progress.fixed}</strong> actually fixed).
          </>
        )}
      </p>

      <div className="mt-4">
        <ProgressChart monthly={progress.monthly} />
      </div>
      <p className="mt-2 text-xs text-sec-muted">
        Month-wise view, last 14 months (anything older is in <strong>earlier</strong>): blue = issues closed that month, pink =
        new issues triaged in, orange line = open backlog remaining.
        {progress.approxDates > 0 && (
          <span className="text-sec-amber-text">
            {" "}
            ({progress.approxDates} closed items never had a resolution date set, so the month shown is when the status moved to Done.)
          </span>
        )}
      </p>
    </SecPanel>
  );
}

/* ── KPI row ───────────────────────────────────────────────────────────────── */

const STRIPE = {
  structure: "from-sec-blue to-sec-purple",
  open: "from-sec-pink to-sec-orange",
  prog: "from-sec-orange to-sec-amber",
  amber: "from-sec-amber to-sec-amber-deep",
};
const VALUE = { structure: "text-sec-ink", open: "text-sec-pink", prog: "text-sec-orange-text", amber: "text-sec-ink" };

function Kpi({ label, tone = "structure", value, detail, jql, jiraBaseUrl }) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-sec-line bg-white px-4 pt-4 pb-3.5">
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-linear-to-r", STRIPE[tone])} aria-hidden="true" />
      <p className={cn("text-[26px] leading-tight font-extrabold tracking-tight", VALUE[tone])}>
        <JiraCount jiraBaseUrl={jiraBaseUrl} jql={jql} className="no-underline hover:underline">
          {value}
        </JiraCount>
      </p>
      <p className="mt-0.5 text-xs font-medium text-sec-muted">{label}</p>
      <p className="text-[11px] text-sec-muted">{detail}</p>
    </article>
  );
}

export function SecurityKpis({ view, window, jiraBaseUrl }) {
  const { kpis, jql, coverage } = view;
  const cov = Object.fromEntries(coverage.map((bucket) => [bucket.key, bucket]));
  const effortCurrent = view.effort.find((scope) => scope.key === "current");
  const cards = [
    { label: "Open pipeline", value: kpis.pipeline, detail: "open + in progress", jql: jql.base },
    { label: "Open", tone: "open", value: kpis.open, detail: "status category: To Do", jql: `${jql.base} AND statusCategory = "To Do" AND status != "Dev To Do"` },
    { label: "In progress", tone: "prog", value: kpis.inProgress, detail: "incl. Dev To Do, review & testing", jql: `${jql.base} AND (statusCategory = "In Progress" OR status = "Dev To Do")` },
    { label: "Overdue — past releases", tone: "open", value: kpis.overdue, detail: "still open past their release", jql: cov.overdue.jql },
    { label: "This release", value: kpis.plannedCurrent, detail: window.current.name, jql: jql.current },
    { label: "Next release", value: kpis.plannedNext, detail: window.next.name, jql: jql.next },
    { label: "Unplanned — no fix version", tone: "amber", value: kpis.noFixVersion, detail: "needs a release", jql: cov.none.jql },
    { label: "Not pointed — no story points", tone: "amber", value: kpis.noStoryPoints, detail: `${window.current.short} release`, jql: effortCurrent?.unsizedJql },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <Kpi key={card.label} {...card} jiraBaseUrl={jiraBaseUrl} />
      ))}
    </section>
  );
}

/* ── Scorecard (rollup) ───────────────────────────────────────────────────── */

function TrendCell({ value }) {
  return <td className={cn("py-2 pr-3 text-right tabular-nums", value > 0 ? "font-bold text-sec-blue-text" : "text-sec-label")}>{value}</td>;
}

export function ProgramScorecard({ view, window, jiraBaseUrl }) {
  const total = view.progress;
  const th = "py-2 pr-3 text-[11px] font-semibold tracking-wide text-sec-muted uppercase";
  return (
    <SecPanel icon={Flag} title="Program scorecard" tag="remediation · delivered · planned">
      <div className="overflow-x-auto">
        <table className="w-full min-w-170 text-[13px]">
          <thead>
            <tr className="border-b border-sec-line text-left">
              <th className={th}>Program</th>
              <th className={`${th} text-right`}>Remediated</th>
              <th className={`${th} text-right`}>Done</th>
              <th className={`${th} text-right`}>Open</th>
              {total.months.map((month) => (
                <th key={month} className={`${th} text-right`}>{month}</th>
              ))}
              <th className={`${th} text-right`}>3 mo</th>
              <th className={`${th} text-right`}>{window.current.short}</th>
              <th className={`${th} text-right`}>{window.next.short}</th>
              <th className={`${th} pr-0 text-right`}>Planned</th>
            </tr>
          </thead>
          <tbody>
            {view.scorecard.map((row) => {
              const tone = pctTone(row.pct);
              return (
                <tr key={row.key} className="border-b border-sec-lavender">
                  <td className="py-2 pr-3 font-bold text-sec-ink">{row.name}</td>
                  <td className="w-28 py-2 pr-3 text-right">
                    <JiraCount jiraBaseUrl={jiraBaseUrl} jql={row.progressJql} className={cn("text-[15px] font-extrabold no-underline", tone.text)}>
                      {row.pct}%
                    </JiraCount>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sec-lavender">
                      <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.max(row.pct, 2)}%` }} />
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.done}</td>
                  <td className="py-2 pr-3 text-right font-bold tabular-nums">{row.remaining}</td>
                  {row.byMonth.map((value, index) => (
                    <TrendCell key={total.months[index]} value={value} />
                  ))}
                  <td className="py-2 pr-3 text-right font-extrabold tabular-nums">{row.last3}</td>
                  <td className="py-2 pr-3 text-right">
                    <JiraCount jiraBaseUrl={jiraBaseUrl} jql={row.currentJql} className={row.plannedCurrent ? "font-bold text-sec-accent" : "text-sec-label"}>
                      {row.plannedCurrent}
                    </JiraCount>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <JiraCount jiraBaseUrl={jiraBaseUrl} jql={row.nextJql} className={row.plannedNext ? "font-bold text-sec-accent" : "text-sec-label"}>
                      {row.plannedNext}
                    </JiraCount>
                  </td>
                  <td className="py-2 text-right font-extrabold tabular-nums">{row.plannedCurrent + row.plannedNext}</td>
                </tr>
              );
            })}
            <tr className="bg-sec-lavender-soft font-extrabold">
              <td className="py-2 pr-3 pl-1">All programs</td>
              <td className="py-2 pr-3 text-right tabular-nums">{total.pct}%</td>
              <td className="py-2 pr-3 text-right tabular-nums">{total.done}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{total.remaining}</td>
              {total.byMonth.map((value, index) => (
                <td key={total.months[index]} className="py-2 pr-3 text-right tabular-nums">{value}</td>
              ))}
              <td className="py-2 pr-3 text-right tabular-nums">{total.last3}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{view.kpis.plannedCurrent}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{view.kpis.plannedNext}</td>
              <td className="py-2 text-right tabular-nums">{view.kpis.plannedCurrent + view.kpis.plannedNext}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-sec-muted">
        <strong>Delivered</strong> — the last 3 complete months; the current month is left out because it is only part-elapsed.{" "}
        <strong>Planned</strong> — still-open issues with a fix version in {window.current.name} or {window.next.name}.{" "}
        <strong>Remediated %</strong> = closed ÷ triaged, counting every Done closure.
      </p>
    </SecPanel>
  );
}

/* ── Coverage ──────────────────────────────────────────────────────────────── */

const COVERAGE_FILL = {
  current: "bg-sec-blue text-white",
  next: "bg-sec-purple text-white",
  later: "bg-sec-amber text-sec-ink",
  overdue: "bg-sec-pink text-white",
  none: "bg-sec-orange text-white",
};

export function CoverageBar({ view, jiraBaseUrl }) {
  const buckets = view.coverage;
  const total = view.kpis.pipeline;
  return (
    <SecPanel icon={CalendarRange} title="Where does every open item stand?" tag={`all ${total} accounted for`}>
      <div className="flex h-8 gap-0.5 overflow-hidden rounded-full border border-sec-line bg-sec-lavender-soft">
        {buckets.map((bucket) =>
          bucket.count > 0 ? (
            <a
              key={bucket.key}
              href={bucket.jql && jiraBaseUrl ? `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(bucket.jql)}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={`${bucket.label}: ${bucket.count} — open in Jira`}
              className={cn("flex h-full items-center justify-center text-[11px] font-bold transition-opacity hover:opacity-85", COVERAGE_FILL[bucket.key])}
              style={{ width: `${Math.max(bucket.pct, 2)}%` }}
            >
              {bucket.pct >= 8 ? bucket.count : ""}
            </a>
          ) : null,
        )}
      </div>
      {/* Buckets as tiles, not a full-width table: on wide screens a table put each count ~1,800px from
          its label. Five tiles keep label, count and share together at every width. */}
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {buckets.map((bucket) => (
          <li key={bucket.key} className="rounded-xl border border-sec-line bg-white px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] leading-tight text-sec-muted">
              <span className={cn("size-2.5 shrink-0 rounded-[3px]", COVERAGE_FILL[bucket.key])} aria-hidden="true" />
              {bucket.label}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <JiraCount jiraBaseUrl={jiraBaseUrl} jql={bucket.jql} className="text-lg font-extrabold text-sec-ink">
                {bucket.count}
              </JiraCount>
              <span className="text-xs text-sec-muted tabular-nums">{bucket.pct}%</span>
            </p>
          </li>
        ))}
        <li className="rounded-xl bg-sec-lavender-soft px-3 py-2.5">
          <p className="text-[11px] leading-tight text-sec-muted">Total open + in progress</p>
          <p className="mt-1 text-lg font-extrabold text-sec-ink tabular-nums">{total}</p>
        </li>
      </ul>
    </SecPanel>
  );
}

/* ── Priority + vulnerability mix ──────────────────────────────────────────── */

function HBar({ label, segments, max, total }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,auto)_1fr_auto] items-center gap-3">
      <span className="truncate text-xs font-medium text-sec-body" title={label}>{label}</span>
      <span className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-sec-lavender-soft">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <span
              key={segment.key}
              title={`${segment.title}: ${segment.value}`}
              className={cn("block h-full first:rounded-l-full last:rounded-r-full", segment.fill)}
              style={{ width: `${Math.max((segment.value / max) * 100, 1.5)}%` }}
            />
          ) : null,
        )}
      </span>
      <span className="text-xs font-bold tabular-nums">{total}</span>
    </div>
  );
}

export function PriorityStatusTable({ view, jiraBaseUrl }) {
  const rows = view.priority;
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <SecPanel
      icon={Target}
      title="Status by priority"
      aside={
        <span className="flex items-center gap-3 text-[11px] text-sec-muted">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-[3px] bg-sec-pink" />Open</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-[3px] bg-sec-orange" />In progress</span>
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <HBar
            key={row.prio}
            label={row.label}
            max={max}
            segments={[
              { key: "open", title: "Open", value: row.open, fill: "bg-sec-pink" },
              { key: "prog", title: "In progress", value: row.inProgress, fill: "bg-sec-orange" },
            ]}
            total={<JiraCount jiraBaseUrl={jiraBaseUrl} jql={row.jql}>{row.total}</JiraCount>}
          />
        ))}
      </div>
      <table className="mt-4 w-full text-[13px]">
        <thead>
          <tr className="border-b border-sec-line text-left text-[11px] tracking-wide text-sec-muted uppercase">
            <th className="py-1.5 font-semibold">Priority</th>
            <th className="py-1.5 text-right font-semibold">Open</th>
            <th className="py-1.5 text-right font-semibold">In progress</th>
            <th className="py-1.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.prio} className="border-b border-sec-lavender last:border-0">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5 text-right font-bold text-sec-pink-text tabular-nums">{row.open}</td>
              <td className="py-1.5 text-right font-bold text-sec-orange-text tabular-nums">{row.inProgress}</td>
              <td className="py-1.5 text-right font-bold tabular-nums">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 1 && (
        <p className="mt-2 text-xs text-sec-muted">Every open item is {rows[0].label} — the open pipeline filter only holds this priority.</p>
      )}
    </SecPanel>
  );
}

export function VulnMixChart({ view, jiraBaseUrl }) {
  const { entries, total } = view.vulnMix;
  return (
    <SecPanel icon={Bug} title="Open + in progress by vulnerability" tag={`${total} items`}>
      <VulnDonut entries={entries} total={total} jiraBaseUrl={jiraBaseUrl} />
    </SecPanel>
  );
}

/* ── Path to zero ──────────────────────────────────────────────────────────── */

const LADDER_FILL = {
  today: "from-sec-blue to-sec-purple",
  current: "from-sec-purple to-sec-pink",
  next: "from-sec-pink to-sec-orange",
};

function PaceTile({ label, value, tone, sign = "" }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-sec-line bg-white px-3 pt-3.5 pb-2.5">
      <span className={cn("absolute inset-x-0 top-0 h-1", tone.bar)} aria-hidden="true" />
      <p className={cn("text-xl font-extrabold tabular-nums", tone.text)}>
        {sign}
        {Math.round(value)}
      </p>
      <p className="text-[11px] text-sec-muted">{label}</p>
    </div>
  );
}

/**
 * "Path to zero" (Naveen 2026-10-20) — the half beside the progress chart on large screens: when the
 * open backlog clears at the current pace, the pace behind it, and what each release buys in
 * remediated %. All derived from numbers already on the page (aggregate.mjs `pathToZero`).
 */
export function PathToZeroPanel({ view, window, jiraBaseUrl }) {
  const path = view.pathToZero;
  const converging = path.monthsToZero !== null;
  const ladderLabel = {
    today: "Today",
    current: `If ${window.current.short} ships as planned`,
    next: `…and ${window.next.short} too`,
  };
  const ladderJql = { today: view.progress.jql, current: view.jql.current, next: view.jql.next };
  return (
    <SecPanel icon={Compass} title="Path to zero" tag="at the last 3 months' pace" className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center rounded-2xl bg-linear-to-br from-sec-lavender-soft to-sec-peach px-5 py-4">
        <p className="text-[11px] font-bold tracking-wider text-sec-muted uppercase">Open backlog reaches zero</p>
        {path.remaining === 0 ? (
          <p className="mt-1 bg-linear-to-r from-sec-blue to-sec-purple bg-clip-text text-4xl font-extrabold text-transparent">Done 🎉</p>
        ) : converging ? (
          <>
            <p className="mt-1 bg-linear-to-r from-sec-purple via-sec-pink to-sec-orange bg-clip-text text-4xl leading-tight font-extrabold text-transparent">
              {path.etaLabel}
            </p>
            <p className="text-[13px] text-sec-body">
              ≈ <strong>{path.monthsToZero}</strong> month{path.monthsToZero === 1 ? "" : "s"} to clear{" "}
              <JiraCount jiraBaseUrl={jiraBaseUrl} jql={`(${view.progress.jql}) AND statusCategory != Done`} className="font-bold">
                {path.remaining}
              </JiraCount>{" "}
              open at <strong>{path.netBurn}</strong> net per month
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl leading-tight font-extrabold text-sec-pink">Not converging</p>
            <p className="text-[13px] text-sec-body">
              New vulnerabilities arrive as fast as they are fixed — <strong>{path.remaining}</strong> stay open at this pace.
            </p>
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <PaceTile label="fixed / month" value={path.fixedPerMonth} tone={{ bar: "bg-sec-blue", text: "text-sec-blue-text" }} />
        <PaceTile label="new / month" value={path.newPerMonth} tone={{ bar: "bg-sec-pink", text: "text-sec-pink-text" }} />
        <PaceTile
          label="net burn / month"
          value={Math.abs(path.netBurn)}
          sign={path.netBurn > 0 ? "▼" : path.netBurn < 0 ? "▲" : ""}
          tone={path.netBurn > 0 ? { bar: "bg-sec-teal", text: "text-sec-teal" } : { bar: "bg-sec-orange", text: "text-sec-orange-text" }}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <p className="text-[11px] font-bold tracking-wider text-sec-muted uppercase">Remediated, release by release</p>
        {path.ladder.map((step) => (
          <div key={step.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-sec-body">
                {ladderLabel[step.key]}
                {step.adds ? (
                  <span className="text-sec-muted">
                    {" "}
                    (+
                    <JiraCount jiraBaseUrl={jiraBaseUrl} jql={ladderJql[step.key]}>
                      {step.adds}
                    </JiraCount>
                    )
                  </span>
                ) : null}
              </span>
              <span className="font-extrabold text-sec-ink tabular-nums">{step.pct}%</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-sec-lavender-soft">
              <div className={cn("h-full rounded-full bg-linear-to-r", LADDER_FILL[step.key])} style={{ width: `${Math.max(step.pct, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="pt-4 text-[11px] text-sec-muted">
        Pace = closures and new arrivals over {view.progress.months[0]} – {view.progress.months[2]}. The ladder is a ceiling: it counts every
        planned item as closed.
      </p>
    </SecPanel>
  );
}
