import React, { useState, useMemo, useRef } from 'react';
import { X, Download } from 'lucide-react';
import { getWeeklyVelocity, formatDate } from '../../utils/sprintUtils.js';
import { getHealthStatus, WORKFLOWS } from '../../workflows.js';

const ISSUES_PER_PAGE = 15;
const EXPORT_WORKFLOWS = ['feature', 'techdebt'];

export function ExportModal({
  sprintConfig, allFilters, issues, issueStages, sprintMetrics, onClose, onExport, loading,
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const offScreenRef = useRef(null);

  const exportFilters = useMemo(
    () => allFilters.filter(f => EXPORT_WORKFLOWS.includes(f.workflow)),
    [allFilters]
  );

  const exportIssues = useMemo(
    () => issues.filter(i => EXPORT_WORKFLOWS.includes(i.workflow)),
    [issues]
  );

  const allRows = useMemo(() => {
    const rows = [];
    exportFilters.forEach(filter => {
      const fi = exportIssues.filter(i => i.filter === filter.name);
      if (!fi.length) return;
      const fp   = fi.reduce((s, i) => s + i.points, 0);
      const fc   = fi.reduce((s, i) => s + (i.points * i.percent / 100), 0);
      const fpct = fp > 0 ? Math.round((fc / fp) * 100) : 0;
      rows.push({ kind: 'filter-header', filter, count: fi.length, fp, fc, fpct });
      fi.forEach(issue => rows.push({ kind: 'issue', issue, filter }));
    });
    return rows;
  }, [exportFilters, exportIssues]);

  const pages = useMemo(() => {
    const result = [{ type: 'summary' }];
    for (let i = 0; i < allRows.length; i += ISSUES_PER_PAGE) {
      result.push({ type: 'issues', rows: allRows.slice(i, i + ISSUES_PER_PAGE) });
    }
    return result;
  }, [allRows]);

  const velocity = getWeeklyVelocity(sprintConfig, sprintMetrics.velocityCompletedPoints, sprintMetrics.velocityPoints);
  const page = pages[currentPage];
  const totalPages = pages.length;

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
              disabled={loading}
            >
              <Download size={14} /> Export PDF
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onExport('image', offScreenRef)}
              disabled={loading}
            >
              <Download size={14} /> Export PNG
            </button>
            <button className="btn btn-ghost btn-sm btn-icon-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="export-modal-body">
          <div className="export-page-content">
            {page.type === 'summary' ? (
              <SummaryPage
                sprintConfig={sprintConfig}
                exportFilters={exportFilters}
                exportIssues={exportIssues}
                issueStages={issueStages}
                sprintMetrics={sprintMetrics}
                velocity={velocity}
              />
            ) : (
              <IssuesPage
                rows={page.rows}
                issueStages={issueStages}
                sprintConfig={sprintConfig}
                pageNumber={currentPage}
                totalPages={totalPages}
              />
            )}
          </div>

          {totalPages > 1 && (
            <div className="export-pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                ← Previous
              </button>
              <span className="export-pagination-label">Page {currentPage + 1} of {totalPages}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
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
              exportFilters={exportFilters}
              exportIssues={exportIssues}
              issueStages={issueStages}
              sprintMetrics={sprintMetrics}
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


function SummaryPage({ sprintConfig, exportFilters, exportIssues, issueStages, sprintMetrics, velocity }) {
  const exportHealthStats = exportIssues.map(i =>
    getHealthStatus(i.percent, issueStages[i.key]?.blocked ?? false, sprintConfig)
  );
  const blockedCount    = exportHealthStats.filter(h => h.status === 'Blocked').length;
  const behindCount     = exportHealthStats.filter(h => h.status === 'Behind').length;
  const atRiskCount     = exportHealthStats.filter(h => h.status === 'At Risk').length;
  const inProgressCount = exportIssues.filter(i => i.percent > 0 && i.percent < 100).length;

  const healthStatus  = sprintMetrics.sprintHealth.status;
  const completionPct = sprintMetrics.points > 0
    ? Math.round((sprintMetrics.completedPoints / sprintMetrics.points) * 100)
    : 0;
  const featuresOnTrack = (sprintMetrics.featureOnTrackCount ?? 0) + (sprintMetrics.featureAheadCount ?? 0);
  const totalFeatures   = sprintMetrics.totalFeatureIssues ?? 0;

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
            {Math.round(sprintMetrics.completedPoints)} / {sprintMetrics.points} story points
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
