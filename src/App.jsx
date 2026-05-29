import React, { useState } from 'react';
import { usePersistedSprintState } from './hooks/usePersistedSprintState.js';
import { useSprintData } from './hooks/useSprintData.js';
import { useSprintMetrics } from './hooks/useSprintMetrics.js';
import { useExport } from './hooks/useExport.js';
import { getWeeklyVelocity, getDaysRemaining, formatDate, getSprintKey } from './utils/sprintUtils.js';
import { TopBar } from './components/organisms/TopBar.jsx';
import { HeroPanel } from './components/organisms/HeroPanel.jsx';
import { MetricGrid } from './components/organisms/MetricGrid.jsx';
import { FilterPanel } from './components/organisms/FilterPanel.jsx';
import { PlannerPanel } from './components/organisms/PlannerPanel.jsx';
import { AppAlertModal } from './components/modals/AppAlertModal.jsx';
import { AddFilterModal } from './components/modals/AddFilterModal.jsx';
import { SprintConfigModal } from './components/modals/SprintConfigModal.jsx';
import { ExportModal } from './components/modals/ExportModal.jsx';

export function App({ authUser, onLogout }) {
  const [appModal, setAppModal] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSprintConfigModal, setShowSprintConfigModal] = useState(false);
  const [shareToast, setShareToast] = useState('');

  const showAlert = (title, body, tone = 'info') => setAppModal({ title, body, tone });

  const persisted = usePersistedSprintState(showAlert);
  const {
    sprintData,
    dynamicFilters, setDynamicFilters,
    issueStages, setIssueStages,
    sprintConfig, setSprintConfig,
    viewDensity, setViewDensity,
    isFiltersPanelCollapsed, setIsFiltersPanelCollapsed,
  } = persisted;

  const [lastSync, setLastSync] = useState(null);

  const { loading, setLoading, handleAddFilter, handleRemoveFilter, handleSyncAll, toggleStage, toggleBlocked } = useSprintData({
    dynamicFilters, setDynamicFilters,
    issueStages, setIssueStages,
    setLastSync,
    showAlert,
  });

  const { allFilters, sprintMetrics, visibleFilters, searchQuery, setSearchQuery } = useSprintMetrics({
    dynamicFilters,
    issueStages,
    sprintConfig,
  });

  const {
    issues, points, avgProgress, completedPoints, sprintHealth,
    totalFeatureIssues, blockedCount, behindCount, atRiskCount, riskCount,
    featureBlockedCount, featureOnTrackCount, featureAheadCount,
    velocityPoints, velocityCompletedPoints,
  } = sprintMetrics;

  const velocity = getWeeklyVelocity(sprintConfig, velocityCompletedPoints, velocityPoints);

  const exportHook = useExport({
    sprintConfig, sprintMetrics,
    setShareToast, showAlert, setLoading,
  });

  const handleShare = () => {
    const shareData = {
      config: sprintConfig,
      filters: dynamicFilters,
      stages: issueStages,
      viewDensity,
      timestamp: new Date().toISOString(),
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))));
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareToast('Shareable link copied to clipboard');
      setTimeout(() => setShareToast(''), 3000);
    }).catch(() => {
      setAppModal({ title: 'Share Link', body: 'Clipboard access was blocked. Copy the link below:', copyUrl: shareUrl });
    });
  };

  const handleSprintSave = (newConfig) => {
    const newSprintKey = getSprintKey(newConfig);
    const newSprintData = sprintData[newSprintKey] || { filters: [], stages: {} };
    setSprintConfig(newConfig);
    setDynamicFilters(newSprintData.filters);
    setIssueStages(newSprintData.stages);
    setShowSprintConfigModal(false);
  };

  const handleReorderFilters = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const reordered = [...dynamicFilters];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setDynamicFilters(reordered);
  };

  const showWelcome = dynamicFilters.length === 0;

  return (
    <div className="app">
      <TopBar
        onAddFilter={() => setShowAddModal(true)}
        onSync={handleSyncAll}
        syncing={loading}
        user={authUser}
        onLogout={onLogout}
      />
      <main className={`app-shell ${viewDensity}`}>
        <HeroPanel
          showWelcome={showWelcome}
          sprintConfig={sprintConfig}
          onAddFilter={() => setShowAddModal(true)}
          onConfigureSprint={() => setShowSprintConfigModal(true)}
          viewDensity={viewDensity}
          onToggleDensity={() => setViewDensity(v => v === 'dense' ? 'relaxed' : 'dense')}
          onShare={handleShare}
          exportMenuProps={{
            loading,
            hasFilters: dynamicFilters.length > 0,
            onToggleMenu: () => exportHook.setShowExportModal(true),
          }}
          daysRemaining={getDaysRemaining(sprintConfig)}
          formatDate={formatDate}
          hasFilters={dynamicFilters.length > 0}
        />

        {!showWelcome && (
          <>
            <MetricGrid
              sprintHealth={sprintHealth}
              issues={issues}
              points={points}
              avgProgress={avgProgress}
              completedPoints={completedPoints}
              velocity={velocity}
              velocityPoints={velocityPoints}
              velocityCompletedPoints={velocityCompletedPoints}
              riskCount={riskCount}
              atRiskCount={atRiskCount}
              behindCount={behindCount}
              blockedCount={blockedCount}
              featureBlockedCount={featureBlockedCount}
              featureAheadCount={featureAheadCount}
              featureOnTrackCount={featureOnTrackCount}
              totalFeatureIssues={totalFeatureIssues}
            />

            <section className={`workspace-grid${isFiltersPanelCollapsed ? ' filters-collapsed' : ''}`}>
              <FilterPanel
                visibleFilters={visibleFilters}
                allFilters={allFilters}
                isCollapsed={isFiltersPanelCollapsed}
                onToggleCollapse={() => setIsFiltersPanelCollapsed(v => !v)}
                onAddFilter={() => setShowAddModal(true)}
                onRemoveFilter={handleRemoveFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onReorderFilters={handleReorderFilters}
              />
              <PlannerPanel
                visibleFilters={visibleFilters}
                allFilters={allFilters}
                issueStages={issueStages}
                onToggleStage={toggleStage}
                onToggleBlocked={toggleBlocked}
                sprintConfig={sprintConfig}
              />
            </section>
          </>
        )}

        {shareToast && <div className="share-toast">{shareToast}</div>}
      </main>

      {appModal && <AppAlertModal modal={appModal} onClose={() => setAppModal(null)} />}
      {showAddModal && <AddFilterModal onAdd={handleAddFilter} onClose={() => setShowAddModal(false)} loading={loading} />}
      {showSprintConfigModal && <SprintConfigModal config={sprintConfig} onSave={handleSprintSave} onClose={() => setShowSprintConfigModal(false)} />}
      {exportHook.showExportModal && (
        <ExportModal
          sprintConfig={sprintConfig}
          allFilters={allFilters}
          issueStages={issueStages}
          onClose={() => exportHook.setShowExportModal(false)}
          onExport={exportHook.handleExport}
          loading={loading}
        />
      )}
    </div>
  );
}
