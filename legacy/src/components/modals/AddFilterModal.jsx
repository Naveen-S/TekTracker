import React, { useState } from 'react';
import { X } from 'lucide-react';

export function AddFilterModal({ onAdd, onClose, loading }) {
  const [sourceType, setSourceType] = useState('filter');
  const [filterId, setFilterId] = useState('');
  const [jqlQuery, setJqlQuery] = useState('');
  const [filterName, setFilterName] = useState('');
  const [workflow, setWorkflow] = useState('feature');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (sourceType === 'filter') {
      if (!filterId.trim()) {
        setError('Please enter a filter ID');
        return;
      }
      onAdd({ type: 'filter', filterId: filterId.trim(), workflow });
    } else if (sourceType === 'jql') {
      if (!jqlQuery.trim()) {
        setError('Please enter a JQL query');
        return;
      }
      if (!filterName.trim()) {
        setError('Please enter a name for this filter');
        return;
      }
      onAdd({ type: 'jql', jql: jqlQuery.trim(), name: filterName.trim(), workflow });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Jira Source</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Workflow Type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" name="workflow" value="feature" checked={workflow === 'feature'} onChange={(e) => setWorkflow(e.target.value)} disabled={loading} />
                <span>Feature Development (10 stages)</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="workflow" value="support" checked={workflow === 'support'} onChange={(e) => setWorkflow(e.target.value)} disabled={loading} />
                <span>Support Bugs (4 stages)</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="workflow" value="techdebt" checked={workflow === 'techdebt'} onChange={(e) => setWorkflow(e.target.value)} disabled={loading} />
                <span>Tech Debt (4 stages)</span>
              </label>
            </div>
            <small>
              {workflow === 'feature'
                ? '📋 PM clarification → HLD/LLD → API contracts → Working APIs → FE integration → E2E testing → QA/PM demo → PR approved → Release ready → 1st Stage Env deployment'
                : workflow === 'support'
                  ? '🐛 Triaged → In Progress → Code Review → In QA'
                  : '🔧 Triaged → In Progress → Code Review → In QA'}
            </small>
          </div>

          <div className="form-group">
            <label>Source Type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" name="sourceType" value="filter" checked={sourceType === 'filter'} onChange={(e) => setSourceType(e.target.value)} disabled={loading} />
                <span>Filter ID</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="sourceType" value="jql" checked={sourceType === 'jql'} onChange={(e) => setSourceType(e.target.value)} disabled={loading} />
                <span>JQL Query</span>
              </label>
            </div>
          </div>

          {sourceType === 'filter' && (
            <div className="form-group">
              <label htmlFor="filterId">Filter ID</label>
              <input id="filterId" type="text" value={filterId} onChange={(e) => setFilterId(e.target.value)} placeholder="e.g., 65834" disabled={loading} autoFocus />
              <small>Enter the numeric filter ID from your Jira filter URL</small>
            </div>
          )}

          {sourceType === 'jql' && (
            <>
              <div className="form-group">
                <label htmlFor="filterName">Filter Name</label>
                <input id="filterName" type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g., DR_GM Support Issues" disabled={loading} autoFocus />
                <small>Give this filter a descriptive name</small>
              </div>

              <div className="form-group">
                <label htmlFor="jqlQuery">JQL Query</label>
                <textarea id="jqlQuery" rows="4" value={jqlQuery} onChange={(e) => setJqlQuery(e.target.value)} placeholder="e.g., project = DR_GM AND status != Done" disabled={loading} className="jql-textarea" />
                <small>Enter the JQL query to fetch issues</small>
              </div>
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
