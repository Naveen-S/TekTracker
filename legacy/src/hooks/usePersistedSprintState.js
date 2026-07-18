import { useState, useEffect } from 'react';
import { getSprintKey, migrateStages } from '../utils/sprintUtils.js';
import { WORKFLOWS } from '../workflows.js';

const WORKFLOW_PRIORITY = (f) => WORKFLOWS[f.workflow || 'feature'].priority;

function sortFiltersByPriority(filters) {
  return [...filters].sort((a, b) => WORKFLOW_PRIORITY(a) - WORKFLOW_PRIORITY(b));
}

function loadPersistedData() {
  try {
    const savedSprintData = localStorage.getItem('sprintTracker_sprintData');
    const savedConfig = localStorage.getItem('sprintTracker_sprintConfig');
    const savedDensity = localStorage.getItem('sprintTracker_viewDensity');
    const savedCollapsed = localStorage.getItem('sprintTracker_filtersPanelCollapsed');

    const config = savedConfig ? JSON.parse(savedConfig) : {
      name: 'May Sprint',
      startDate: '2026-05-01',
      endDate: '2026-05-15',
    };

    const rawSprintData = savedSprintData ? JSON.parse(savedSprintData) : {};
    // Sort all sprints' filters once on load so the default order (Feature → TechDebt → Support)
    // is applied to any data stored before manual reordering was possible.
    const sprintData = Object.fromEntries(
      Object.entries(rawSprintData).map(([key, val]) => [
        key,
        { ...val, filters: sortFiltersByPriority(val.filters || []) },
      ])
    );
    const sprintKey = getSprintKey(config);
    const currentSprintData = sprintData[sprintKey] || { filters: [], stages: {} };

    return {
      sprintData,
      filters: currentSprintData.filters,
      stages: migrateStages(currentSprintData.stages || {}),
      config,
      density: savedDensity || 'dense',
      collapsed: savedCollapsed === 'true',
    };
  } catch {
    return {
      sprintData: {},
      filters: [],
      stages: {},
      config: { name: 'May Sprint', startDate: '2026-05-01', endDate: '2026-05-15' },
      density: 'dense',
      collapsed: false,
    };
  }
}

export function usePersistedSprintState(showAlert) {
  const initial = loadPersistedData();

  const [sprintData, setSprintData] = useState(initial.sprintData);
  const [dynamicFilters, setDynamicFilters] = useState(initial.filters);
  const [issueStages, setIssueStages] = useState(initial.stages);
  const [sprintConfig, setSprintConfig] = useState(initial.config);
  const [viewDensity, setViewDensity] = useState(initial.density);
  const [isFiltersPanelCollapsed, setIsFiltersPanelCollapsed] = useState(initial.collapsed);

  // Restore shared state from URL ?share= param on first mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (!shareParam) return;

    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(shareParam))));
      const sprintKey = getSprintKey(decoded.config);
      const currentSprintData = JSON.parse(localStorage.getItem('sprintTracker_sprintData') || '{}');
      const updatedSprintData = {
        ...currentSprintData,
        [sprintKey]: {
          filters: decoded.filters,
          stages: migrateStages(decoded.stages || {}),
        },
      };
      localStorage.setItem('sprintTracker_sprintData', JSON.stringify(updatedSprintData));
      localStorage.setItem('sprintTracker_sprintConfig', JSON.stringify(decoded.config));
      localStorage.setItem('sprintTracker_viewDensity', decoded.viewDensity || 'dense');

      setSprintData(updatedSprintData);
      setSprintConfig(decoded.config);
      setDynamicFilters(decoded.filters);
      setIssueStages(migrateStages(decoded.stages || {}));
      setViewDensity(decoded.viewDensity || 'dense');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      showAlert('Could Not Load Shared View', 'The link may be invalid or corrupted.', 'error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist sprint-specific data whenever filters, stages, or config change
  useEffect(() => {
    try {
      const sprintKey = getSprintKey(sprintConfig);
      const updatedSprintData = {
        ...sprintData,
        [sprintKey]: { filters: dynamicFilters, stages: issueStages },
      };
      setSprintData(updatedSprintData);
      localStorage.setItem('sprintTracker_sprintData', JSON.stringify(updatedSprintData));
    } catch (error) {
      console.error('Error saving sprint data:', error);
    }
  }, [dynamicFilters, issueStages, sprintConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem('sprintTracker_sprintConfig', JSON.stringify(sprintConfig));
    } catch (error) {
      console.error('Error saving sprint config:', error);
    }
  }, [sprintConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('sprintTracker_viewDensity', viewDensity);
    } catch (error) {
      console.error('Error saving view density:', error);
    }
  }, [viewDensity]);

  useEffect(() => {
    try {
      localStorage.setItem('sprintTracker_filtersPanelCollapsed', isFiltersPanelCollapsed.toString());
    } catch (error) {
      console.error('Error saving filters panel state:', error);
    }
  }, [isFiltersPanelCollapsed]);

  return {
    sprintData,
    setSprintData,
    dynamicFilters,
    setDynamicFilters,
    issueStages,
    setIssueStages,
    sprintConfig,
    setSprintConfig,
    viewDensity,
    setViewDensity,
    isFiltersPanelCollapsed,
    setIsFiltersPanelCollapsed,
  };
}
