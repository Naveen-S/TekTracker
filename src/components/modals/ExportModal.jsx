import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { getWeeklyVelocity, formatDate } from '../../utils/sprintUtils.js';
import { getHealthStatus, WORKFLOWS } from '../../workflows.js';
import { computeSprintMetrics } from '../../utils/sprintMetricsCompute.js';

const ISSUES_PER_PAGE = 15;

export function ExportModal({
  sprintConfig, allFilters, issueStages, onClose, onExport, loading,
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set(allFilters.map(f => f.id)));
  const offScreenRef = useRef(null);

  const selectedFilters = useMemo(
    () => allFilters.filter(f => selectedIds.has(f.id)),
    [allFilters, selectedIds]
  );

  // All report numbers (completion, velocity, health, counts) come from this
  // single recompute over the selected filters, so preview and capture match.
  const exportMetrics = useMemo(
    () => computeSprintMetrics(selectedFilters, issueStages, sprintConfig),
    [selectedFilters, issueStages, sprintConfig]
  );
  const exportIssues = exportMetrics.issues;

  const allRows = useMemo(() => {
    const rows = [];
    selectedFilters.forEach(filter => {
      const fi = exportIssues.filter(i => i.filter === filter.name);
      if (!fi.length) return;
      const fp   = fi.reduce((s, i) => s + i.points, 0);
      const fc   = fi.reduce((s, i) => s + (i.points * i.percent / 100), 0);
      const fpct = fp > 0 ? Math.round((fc / fp) * 100) : 0;
      rows.push({ kind: 'filter-header', filter, count: fi.length, fp, fc, fpct });
      fi.forEach(issue => rows.push({ kind: 'issue', issue, filter }));
    });
    return rows;
  }, [selectedFilters, exportIssues]);

  const pages = useMemo(() => {
    const result = [{ type: 'summary' }];
    for (let i = 0; i < allRows.length; i += ISSUES_PER_PAGE) {
      result.push({ type: 'issues', rows: allRows.slice(i, i + ISSUES_PER_PAGE) });
    }
    return result;
  }, [allRows]);

  // Keep the previewed page in range when deselecting filters drops pages.
  useEffect(() => {
    setCurrentPage(p => Math.min(p, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  // Velocity over ALL included items (every selected filter's effort counts).
  const velocity = useMemo(
    () => getWeeklyVelocity(sprintConfig, exportMetrics.completedPoints, exportMetrics.points),
    [sprintConfig, exportMetrics]
  );

  const toggleFilter = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const nothingSelected = selectedIds.size === 0;
  const totalPages = pages.length;
  // Render-safe index: the clamp effect above syncs state after render, but the
  // first render after a shrink could still index out of range here.
  const pageIndex = Math.min(currentPage, totalPages - 1);
  const page = pages[pageIndex];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content export-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header" data-tone="info">
          <div>
            <div className="modal-eyebrow">Sprint Report</div>
            <h2>{sprintConfig.name}</h2>
          </div>
          <div className="export-modal-header-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onExport('pdf', offScreenRef)}
              disabled={loading || nothingSelected}
            >
              <Download size={14} /> Export PDF
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onExport('image', offScreenRef)}
              disabled={loading || nothingSelected}
            >
              <Download size={14} /> Export PNG
            </button>
            <button className="btn btn-ghost btn-sm btn-icon-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="export-modal-body">
          <div className="export-filter-toggles">
            <span className="export-filter-toggles-label">Include filters</span>
            <div className="export-filter-toggles-row">
              {allFilters.map(f => {
                const active = selectedIds.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`export-filter-toggle${active ? ' is-active' : ''}`}
                    style={{ '--accent': f.accent }}
                    aria-pressed={active}
                    onClick={() => toggleFilter(f.id)}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
            {nothingSelected && (
              <span className="export-filter-toggles-hint">Select at least one filter to export.</span>
            )}
          </div>

          <div className="export-page-content">
            {page.type === 'summary' ? (
              <SummaryPage
                sprintConfig={sprintConfig}
                exportFilters={selectedFilters}
                exportIssues={exportIssues}
                issueStages={issueStages}
                exportMetrics={exportMetrics}
                velocity={velocity}
              />
            ) : (
              <IssuesPage
                rows={page.rows}
                issueStages={issueStages}
                sprintConfig={sprintConfig}
                pageNumber={pageIndex}
                totalPages={totalPages}
              />
            )}
          </div>

          {totalPages > 1 && (
            <div className="export-pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0}
              >
                ← Previous
              </button>
              <span className="export-pagination-label">Page {pageIndex + 1} of {totalPages}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(Math.min(totalPages - 1, pageIndex + 1))}
                disabled={pageIndex === totalPages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div ref={offScreenRef} className="export-offscreen">
          <div className="export-print-page">
            <SummaryPage
              sprintConfig={sprintConfig}
              exportFilters={selectedFilters}
              exportIssues={exportIssues}
              issueStages={issueStages}
              exportMetrics={exportMetrics}
              velocity={velocity}
            />
          </div>
          {pages.slice(1).map((p, i) => (
            <div key={i} className="export-print-page">
              <IssuesPage
                rows={p.rows}
                issueStages={issueStages}
                sprintConfig={sprintConfig}
                pageNumber={i + 1}
                totalPages={totalPages - 1}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}


function SummaryPage({ sprintConfig, exportFilters, exportIssues, issueStages, exportMetrics, velocity }) {
  const blockedCount    = exportMetrics.blockedCount;
  const behindCount     = exportMetrics.behindCount;
  const atRiskCount     = exportMetrics.atRiskCount;
  const inProgressCount = exportIssues.filter(i => i.percent > 0 && i.percent < 100).length;

  const healthStatus  = exportMetrics.sprintHealth.status;
  const completionPct = exportMetrics.points > 0
    ? Math.round((exportMetrics.completedPoints / exportMetrics.points) * 100)
    : 0;
  const featuresOnTrack = (exportMetrics.featureOnTrackCount ?? 0) + (exportMetrics.featureAheadCount ?? 0);
  const totalFeatures   = exportMetrics.totalFeatureIssues ?? 0;

  const generatedOn = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const healthCardMod = ['Healthy', 'Excellent', 'Complete'].includes(healthStatus)
    ? 'export-overall-card--health-good'
    : ['At Risk', 'Critical'].includes(healthStatus)
    ? 'export-overall-card--health-risk'
    : 'export-overall-card--health-warn';

  return (
    <div className="export-summary">
      <div className="export-summary-header">
        <div>
          <p className="export-eyebrow">Sprint Report</p>
          <h3 className="export-summary-title">{sprintConfig.name}</h3>
          <p className="export-date-range">
            {formatDate(sprintConfig.startDate)} – {formatDate(sprintConfig.endDate)}
          </p>
        </div>
        <div className="export-generated-on">
          <span>Generated on</span>
          <strong>{generatedOn}</strong>
        </div>
      </div>
      <div className="export-header-divider" />

      <p className="export-section-label">
        THIS WEEK'S UPDATE — WEEK {velocity.weeksElapsed} OF {velocity.totalWeeks}
      </p>
      <div className="export-summary-grid">
        <div className="export-metric-box">
          <p className="export-metric-box-label">WEEK</p>
          <strong className="export-metric-box-value">
            {velocity.weeksElapsed} / {velocity.totalWeeks}
          </strong>
          <span className="export-metric-box-detail">
            {velocity.onTrack ? 'On pace' : 'Behind pace'}
          </span>
        </div>
        <div className="export-metric-box">
          <p className="export-metric-box-label">VELOCITY</p>
          <strong className="export-metric-box-value">{velocity.velocity} pts</strong>
          <span className="export-metric-box-detail">
            per week · {velocity.weeksNeeded}w needed
          </span>
        </div>
        <div className="export-metric-box">
          <p className="export-metric-box-label">IN PROGRESS</p>
          <strong className="export-metric-box-value">{inProgressCount}</strong>
          <span className="export-metric-box-detail">of {exportIssues.length} issues</span>
        </div>
        <div className="export-metric-box">
          <p className="export-metric-box-label">BLOCKED</p>
          <strong className="export-metric-box-value">{blockedCount}</strong>
          <span className="export-metric-box-detail">
            {behindCount} behind · {atRiskCount} at risk
          </span>
        </div>
      </div>

      <div className="export-filter-list">
        {exportFilters.map(filter => {
          const fi = exportIssues.filter(i => i.filter === filter.name);
          const fp   = fi.reduce((s, i) => s + i.points, 0);
          const fc   = fi.reduce((s, i) => s + (i.points * i.percent / 100), 0);
          const fpct = fp > 0 ? Math.round((fc / fp) * 100) : 0;
          const done   = fi.filter(i => i.percent === 100).length;
          const active = fi.filter(i => i.percent > 0 && i.percent < 100).length;
          const workflowName = WORKFLOWS[filter.workflow || 'feature'].name;
          return (
            <div
              key={filter.id}
              className="export-filter-progress-card"
              style={{ '--accent': filter.accent }}
            >
              <div className="export-filter-progress-header">
                <div>
                  <strong className="export-filter-name">{filter.name}</strong>
                  <span className="export-filter-workflow">{workflowName}</span>
                </div>
                <span className="export-filter-pct">{fpct}%</span>
              </div>
              <div className="export-filter-progress-meta">
                {done} done · {active} active · {fi.length} total
              </div>
              <div className="export-filter-bar-bg">
                <div className="export-filter-bar-fill" style={{ width: `${fpct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="export-section-label export-section-label--spaced">OVERALL SPRINT METRICS</p>
      <div className="export-overall-metrics">
        <div className={`export-overall-card ${healthCardMod}`}>
          <span className="export-overall-card-label">SPRINT HEALTH</span>
          <strong className="export-overall-card-value">{healthStatus}</strong>
          <span className="export-overall-card-detail">
            {featuresOnTrack}/{totalFeatures} features on track
          </span>
        </div>
        <div className="export-overall-card export-overall-card--completion">
          <span className="export-overall-card-label">COMPLETION</span>
          <strong className="export-overall-card-value">{completionPct}%</strong>
          <span className="export-overall-card-detail">
            {Math.round(exportMetrics.completedPoints)} / {exportMetrics.points} story points
          </span>
        </div>
        <div className="export-overall-card export-overall-card--projected">
          <span className="export-overall-card-label">PROJECTED</span>
          <strong className="export-overall-card-value">
            {Math.round(velocity.projectedPoints)} pts
          </strong>
          <span className="export-overall-card-detail">by end of sprint</span>
        </div>
      </div>
    </div>
  );
}

function IssuesPage({ rows, issueStages, sprintConfig, pageNumber, totalPages }) {
  return (
    <div className="export-issues-page">
      <p className="export-section-label">WORK BREAKDOWN BY FILTER</p>
      <table className="export-table">
        <thead>
          <tr className="export-table-head-row">
            <th className="export-th export-th-key">Key</th>
            <th className="export-th export-th-title">Title</th>
            <th className="export-th export-th-progress">Progress</th>
            <th className="export-th export-th-stages">Stages</th>
            <th className="export-th export-th-health">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.kind === 'filter-header') {
              const { filter, count, fp, fc, fpct } = row;
              const workflowName = WORKFLOWS[filter.workflow || 'feature'].name;
              return (
                <tr key={`fh-${filter.id}-${idx}`} className="export-filter-header-row">
                  <td colSpan={5} className="export-filter-header-cell" style={{ '--accent': filter.accent }}>
                    <div className="export-filter-header-top">
                      <span>
                        <span className="export-filter-header-dot" />
                        {filter.name}
                      </span>
                      <span className="export-filter-header-pct">{fpct}%</span>
                    </div>
                    <div className="export-filter-header-sub">
                      <span>{workflowName} · {count} issues</span>
                      <span>{Math.round(fc)} / {fp} pts</span>
                    </div>
                    <div className="export-filter-bar-bg export-filter-bar-bg--slim">
                      <div className="export-filter-bar-fill" style={{ width: `${fpct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            }
            const { issue } = row;
            const stageData       = issueStages[issue.key];
            const health          = getHealthStatus(issue.percent, stageData?.blocked ?? false, sprintConfig);
            const completedStages = stageData?.stages?.filter(Boolean).length ?? 0;
            const totalStages     = stageData?.stages?.length ?? 0;
            const pctClass =
              issue.percent === 100 ? 'complete' :
              issue.percent > 0    ? 'in-progress' : 'not-started';
            return (
              <tr key={issue.key} className="export-table-row">
                <td className="export-td export-td-key">{issue.key}</td>
                <td className="export-td export-td-title">
                  {issue.title.length > 55 ? issue.title.slice(0, 55) + '…' : issue.title}
                </td>
                <td className="export-td export-td-progress">
                  <span className={`export-pct-badge export-pct-badge--${pctClass}`}>{issue.percent}%</span>
                </td>
                <td className="export-td export-td-stages">
                  {totalStages > 0 ? `${completedStages} / ${totalStages}` : '—'}
                </td>
                <td className="export-td export-td-health">
                  <span
                    className="export-health-badge"
                    style={{ background: health.bgColor, color: health.color, borderColor: health.borderColor }}
                  >
                    {health.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="export-page-footer">
        Page {pageNumber} of {totalPages}
      </div>
    </div>
  );
}
