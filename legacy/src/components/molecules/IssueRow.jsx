import React from 'react';
import { getJiraIssueUrl } from '../../jiraService.js';
import {
  calculateWeightedCompletion,
  getHealthStatus,
  getStagesForFilter,
  getWeightsForFilter,
} from '../../workflows.js';

export function IssueRow({ issue, filter, stageCompletion, isBlocked = false, onToggleStage, onToggleBlocked, sprintConfig }) {
  const filterStages = getStagesForFilter(filter);
  const weights = getWeightsForFilter(filter);
  const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
  const health = getHealthStatus(completionPercent, isBlocked, sprintConfig);

  return (
    <div className="matrix-grid issue-row" style={{ '--stage-count': filterStages.length, '--accent': filter.accent }}>
      <div className="sticky-cell issue-cell">
        <div className="issue-cell-header">
          <a href={getJiraIssueUrl(issue.key)} target="_blank" rel="noopener noreferrer" className="issue-key-link" title="Open in Jira">
            {issue.key}
          </a>
          <span className={`completion-badge ${completionPercent === 100 ? 'complete' : completionPercent > 0 ? 'in-progress' : 'not-started'}`}>
            {completionPercent}%
          </span>
        </div>
        <strong className="issue-title">{issue.title}</strong>
        <div className="issue-metadata">
          <span>{issue.owner}</span>
          <span>·</span>
          <span>{issue.type}</span>
          <span>·</span>
          <span>{issue.points} pts</span>
          {issue.jiraStatus && (
            <>
              <span>·</span>
              <span className="jira-status-inline">{issue.jiraStatus}</span>
            </>
          )}
        </div>
        {(issue.sprint || issue.fixVersions) && (
          <div className="issue-metadata issue-metadata-tags">
            {issue.sprint && <span className="sprint-inline">{issue.sprint}</span>}
            {issue.fixVersions && <span className="fixversion-inline">{issue.fixVersions}</span>}
          </div>
        )}
        <a href={getJiraIssueUrl(issue.key)} target="_blank" rel="noopener noreferrer" className="view-in-jira-link">
          View in Jira →
        </a>
        <div className="mini-progress-bar">
          <div className="mini-progress-fill" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {filterStages.map((stage, index) => {
        const isCompleted = stageCompletion[index];
        const isCurrent = !isCompleted && (index === 0 || stageCompletion[index - 1]);
        const percentPerStage = Math.round(100 / filterStages.length);
        const percentageRange = `${index * percentPerStage}% - ${(index + 1) * percentPerStage}%`;

        return (
          <div
            className={`stage-cell${isCompleted ? ' is-done' : ''}${isCurrent ? ' is-current' : ''} clickable-stage`}
            key={stage}
            onClick={() => onToggleStage(issue.key, index, filter)}
            title={`${stage}\n${isCompleted ? `✓ Complete (${percentageRange})` : `Click to mark complete (${percentageRange})`}`}
          >
            {isCompleted && <span className="stage-check">✓</span>}
            {isCurrent && !isCompleted && <span className="stage-progress">○</span>}
            {!isCompleted && !isCurrent && <span className="stage-empty">○</span>}
          </div>
        );
      })}

      <div className="status-cell">
        <div
          className="health-indicator"
          style={{ color: health.color, borderColor: health.borderColor, backgroundColor: health.bgColor }}
          onClick={() => onToggleBlocked(issue.key)}
          title={`${health.status}${isBlocked ? ' - Click to unblock' : ' - Click to mark as blocked'}\n\nProgress: ${completionPercent}%`}
        >
          <span className="health-icon">{health.icon}</span>
          <span className="health-label">{health.status}</span>
        </div>
      </div>
    </div>
  );
}
