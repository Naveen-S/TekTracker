import React, { useRef } from 'react';
import { Filter, GripVertical, Plus, Search, X } from 'lucide-react';
import { SearchBox } from '../molecules/SearchBox.jsx';

export function FilterPanel({
  visibleFilters,
  allFilters,
  isCollapsed,
  onToggleCollapse,
  onAddFilter,
  onRemoveFilter,
  searchQuery,
  onSearchChange,
  onReorderFilters,
}) {
  const dragIndexRef = useRef(null);
  const dragOverIndexRef = useRef(null);
  const didDragRef = useRef(false);

  const handleDragStart = (e, index) => {
    dragIndexRef.current = index;
    didDragRef.current = true;
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => {
      e.target.closest('.filter-card')?.classList.add('dragging');
    });
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndexRef.current === index) return;
    document.querySelectorAll('.filter-card.drag-over')
      .forEach(el => el.classList.remove('drag-over'));
    dragOverIndexRef.current = index;
    e.currentTarget.classList.add('drag-over');
  };

  const cleanup = () => {
    document.querySelectorAll('.filter-card.dragging, .filter-card.drag-over')
      .forEach(el => el.classList.remove('dragging', 'drag-over'));
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
    setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    cleanup();
    if (from !== null && from !== index) onReorderFilters(from, index);
  };

  const handleDragEnd = () => cleanup();

  return (
    <aside className={`filter-panel${isCollapsed ? ' collapsed' : ''}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Connected JQL</p>
          <h2>Jira filters</h2>
        </div>
        <div className="panel-heading-actions">
          <button
            className="icon-button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand filters' : 'Collapse filters'}
            title={isCollapsed ? 'Expand filters panel' : 'Collapse filters panel'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
          <button className="icon-button" onClick={onAddFilter} aria-label="Add filter" title="Add Jira filter">
            <Plus size={18} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <SearchBox value={searchQuery} onChange={onSearchChange} placeholder="Search filters, owners, keys" />

          <div className="filter-list">
            {allFilters.length === 0 ? (
              <div className="empty-state">
                <Filter size={48} strokeWidth={1.5} />
                <h3>No filters added yet</h3>
                <p>Click "Add Jira filter" above to get started</p>
                <small>You'll need a filter ID from Jira</small>
              </div>
            ) : visibleFilters.length === 0 ? (
              <div className="empty-state compact">
                <Search size={36} strokeWidth={1.5} />
                <h3>No matches</h3>
                <p>Try a filter name, owner, issue key, or Jira status</p>
              </div>
            ) : (
              visibleFilters.map((filter, index) => {
                const totalPts = filter.issues.reduce((sum, issue) => sum + issue.points, 0);
                const donePts  = filter.issues.reduce((sum, issue) => sum + (issue.percent === 100 ? issue.points : 0), 0);
                const pct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
                const isDragEnabled = !searchQuery;
                return (
                  <article
                    className="filter-card"
                    key={filter.id}
                    style={{ '--accent': filter.accent }}
                    draggable={isDragEnabled}
                    onDragStart={isDragEnabled ? (e) => handleDragStart(e, index) : undefined}
                    onDragOver={isDragEnabled ? (e) => handleDragOver(e, index) : undefined}
                    onDrop={isDragEnabled ? (e) => handleDrop(e, index) : undefined}
                    onDragEnd={isDragEnabled ? handleDragEnd : undefined}
                    onClick={() => {
                      if (didDragRef.current) return;
                      document.getElementById(`filter-section-${filter.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <div className="filter-card-title">
                      {isDragEnabled && (
                        <span className="drag-handle" aria-hidden="true">
                          <GripVertical size={14} />
                        </span>
                      )}
                      <span className="filter-dot" />
                      <strong>{filter.name}</strong>
                      <button
                        className="remove-filter-btn"
                        onClick={(e) => { e.stopPropagation(); onRemoveFilter(filter.id); }}
                        aria-label="Remove filter"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {filter.jql && (
                      <p title={filter.jql}>
                        {filter.jql.length > 80 ? `${filter.jql.substring(0, 80)}…` : filter.jql}
                      </p>
                    )}
                    <div className="filter-stats">
                      <span>{filter.issues.length} issues</span>
                      <span>{totalPts} pts</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="filter-card-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
}
