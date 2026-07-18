import React from 'react';
import { Search, TrendingUp } from 'lucide-react';
import { IssueRow } from '../molecules/IssueRow.jsx';
import { getStagesForFilter, WORKFLOWS } from '../../workflows.js';

export function PlannerPanel({ visibleFilters, allFilters, issueStages, onToggleStage, onToggleBlocked, sprintConfig }) {
  return (
    <section className="planner-panel">
      <div className="panel-heading planner-heading">
        <div>
          <p className="eyebrow">Delivery matrix</p>
          <h2>Sprint status by delivery stage</h2>
          {allFilters.length > 0 && (
            <small className="planner-hint">Click any stage cell to mark it complete or incomplete</small>
          )}
        </div>
        <div className="legend">
          <span><i className="legend-box done" /> Done</span>
          <span><i className="legend-box progress" /> Active</span>
          <span><i className="legend-box new" /> Pending</span>
        </div>
      </div>

      <div className="matrix-scroll" role="region" aria-label="Sprint delivery matrix" tabIndex="0">
        {allFilters.length === 0 ? (
          <div className="empty-state-matrix">
            <TrendingUp size={64} strokeWidth={1.5} />
            <h3>No sprint data to display</h3>
            <p>Add a Jira filter to see your sprint delivery matrix</p>
          </div>
        ) : visibleFilters.length === 0 ? (
          <div className="empty-state-matrix">
            <Search size={56} strokeWidth={1.5} />
            <h3>No matching work</h3>
            <p>Clear the search to return to the full sprint matrix</p>
          </div>
        ) : (
          visibleFilters.map((filter) => {
            const filterStages = getStagesForFilter(filter);
            return (
              <div className="filter-section" key={filter.id} id={`filter-section-${filter.id}`}>
                <div className="section-label" style={{ '--accent': filter.accent }}>
                  <span>{filter.name}</span>
                  <em>{filter.issues.length} items · {WORKFLOWS[filter.workflow || 'feature'].name}</em>
                </div>

                <div className="matrix-grid matrix-header" style={{ '--stage-count': filterStages.length }}>
                  <div className="sticky-cell header-cell">Jira issue</div>
                  {filterStages.map((stage) => <div className="header-cell" key={stage}>{stage}</div>)}
                  <div className="header-cell">Health</div>
                </div>

                {filter.issues.map((issue) => (
                  <IssueRow
                    key={issue.key}
                    issue={issue}
                    filter={filter}
                    stageCompletion={issueStages[issue.key]?.stages ?? new Array(filterStages.length).fill(false)}
                    isBlocked={issueStages[issue.key]?.blocked ?? false}
                    onToggleStage={onToggleStage}
                    onToggleBlocked={onToggleBlocked}
                    sprintConfig={sprintConfig}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
