import React from 'react';
import { CheckCircle2, Clock3, Link2, Plus, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { ExportMenu } from '../molecules/ExportMenu.jsx';

export function HeroPanel({
  showWelcome,
  sprintConfig,
  onAddFilter,
  onConfigureSprint,
  viewDensity,
  onToggleDensity,
  onShare,
  exportMenuProps,
  daysRemaining,
  formatDate,
  hasFilters,
}) {
  if (showWelcome) {
    return (
      <section className="hero-panel welcome">
        <div className="welcome-content">
          <h1>Sprint Tracker</h1>
          <p className="welcome-description">Track delivery progress across multiple Jira filters with real-time visibility</p>

          {sprintConfig && (
            <div className="welcome-sprint-info">
              <span className="sprint-badge">
                {sprintConfig.name} • {formatDate(sprintConfig.startDate)} - {formatDate(sprintConfig.endDate)}
              </span>
            </div>
          )}

          <div className="welcome-actions">
            <button className="btn btn-on-dark btn-primary-on-dark primary-button large" onClick={onAddFilter}>
              <Plus size={18} />
              Add Jira Filter to Get Started
            </button>
            <button className="btn btn-on-dark secondary-button" onClick={onConfigureSprint}>
              <Clock3 size={16} />
              {sprintConfig ? 'Change Sprint' : 'Configure Sprint Dates'}
            </button>
          </div>

          <div className="welcome-features">
            <div className="feature-item">
              <CheckCircle2 size={18} />
              <span>Track multiple workflows (Features, Support, Tech Debt)</span>
            </div>
            <div className="feature-item">
              <TrendingUp size={18} />
              <span>Real-time progress & health monitoring</span>
            </div>
            <div className="feature-item">
              <Link2 size={18} />
              <span>Sync with any Jira filter or JQL query</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-panel">
      <div>
        <p className="eyebrow">{sprintConfig.name} · {formatDate(sprintConfig.startDate)} - {formatDate(sprintConfig.endDate)}</p>
        <h1>Multi-filter sprint planner</h1>
        <p className="hero-copy">
          A single operating view for roadmap, support, tech debt, and AI Jira filters with status, blockers, completion, and stage-by-stage delivery visibility.
          <span className={`days-remaining${daysRemaining < 3 ? ' urgent' : ''}`}>
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Last day!' : 'Sprint ended'}
          </span>
        </p>
      </div>

      <div className="hero-actions">
        <button
          className="btn btn-on-dark btn-sm"
          onClick={onToggleDensity}
          title={viewDensity === 'dense' ? 'Switch to Relaxed View' : 'Switch to Dense View'}
        >
          <SlidersHorizontal size={16} /> {viewDensity === 'dense' ? 'Relaxed' : 'Dense'}
        </button>
        <button className="btn btn-on-dark btn-sm" onClick={onConfigureSprint}>
          <Clock3 size={16} /> Configure Sprint
        </button>
        <ExportMenu {...exportMenuProps} hasFilters={hasFilters} />
        <button className="btn btn-on-dark btn-sm" onClick={onShare} disabled={!hasFilters}>
          <Link2 size={16} /> Share View
        </button>
      </div>
    </section>
  );
}
