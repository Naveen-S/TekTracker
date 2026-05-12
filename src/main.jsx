import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle2, Clock3, Download, Filter, Link2, Plus, RefreshCcw, Search, SlidersHorizontal, TrendingUp, X } from 'lucide-react';
import './styles.css';
import { IssueRow, Metric, VelocityMetric, TopBar, LoginForm } from './components/index.js';
import { fetchFilterIssues, fetchJQLIssues, transformFilter } from './jiraService.js';
import {
  calculateWeightedCompletion,
  getHealthStatus,
  getStagesForFilter,
  getWeightsForFilter,
  SPRINT_GATES,
  stages,
  WORKFLOWS,
} from './workflows.js';

// Start with no filters - users will add them dynamically from Jira
const filters = [];

const statusTone = {
  Done: 'done',
  'On Track': 'track',
  'In Progress': 'progress',
  'At Risk': 'risk',
  New: 'new',
};

function getAllIssues() {
  return filters.flatMap((filter) => filter.issues.map((issue) => ({ ...issue, filter: filter.name, accent: filter.accent })));
}

function summarize() {
  const issues = getAllIssues();
  const points = issues.reduce((sum, issue) => sum + issue.points, 0);
  const donePoints = issues.filter((issue) => issue.status === 'Done').reduce((sum, issue) => sum + issue.points, 0);
  const riskCount = issues.filter((issue) => issue.status === 'At Risk').length;
  const avgProgress = Math.round(issues.reduce((sum, issue) => sum + issue.percent, 0) / issues.length);

  return { issues, points, donePoints, riskCount, avgProgress };
}

function migrateStages(stages) {
  const migrated = {};
  for (const [key, value] of Object.entries(stages)) {
    migrated[key] = Array.isArray(value)
      ? { stages: value, blocked: false }
      : value;
  }
  return migrated;
}

const PROXY_ROOT = (import.meta.env.VITE_JIRA_API_BASE_URL || 'http://localhost:3001/api/jira')
  .replace(/\/api\/jira\/?$/, '');

function Root() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    fetch(`${PROXY_ROOT}/api/auth/me`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(user => { setAuthUser(user); setAuthReady(true); })
      .catch(() => setAuthReady(true));
  }, []);

  const handleLogin = (user) => setAuthUser(user);

  const handleLogout = async () => {
    await fetch(`${PROXY_ROOT}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthUser(null);
  };

  if (!authReady) {
    return <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--fg-3)' }}>Loading…</div>;
  }

  if (!authUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <App authUser={authUser} onLogout={handleLogout} />;
}

function App({ authUser, onLogout }) {
  // Load persisted data from localStorage
  const loadPersistedData = () => {
    try {
      // Load sprint-specific data
      const savedSprintData = localStorage.getItem('sprintTracker_sprintData');
      const savedConfig = localStorage.getItem('sprintTracker_sprintConfig');
      const savedDensity = localStorage.getItem('sprintTracker_viewDensity');
      const savedCollapsed = localStorage.getItem('sprintTracker_filtersPanelCollapsed');

      const config = savedConfig ? JSON.parse(savedConfig) : {
        name: 'May Sprint',
        startDate: '2026-05-01',
        endDate: '2026-05-15',
      };

      const sprintData = savedSprintData ? JSON.parse(savedSprintData) : {};
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
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return {
        sprintData: {},
        filters: [],
        stages: {},
        config: {
          name: 'May Sprint',
          startDate: '2026-05-01',
          endDate: '2026-05-15',
        },
        density: 'dense',
        collapsed: false,
      };
    }
  };

  // Generate a unique key for a sprint based on its configuration
  const getSprintKey = (config) => {
    return `${config.startDate}_${config.endDate}`;
  };

  const persistedData = loadPersistedData();

  const [sprintData, setSprintData] = useState(persistedData.sprintData); // All sprint data
  const [dynamicFilters, setDynamicFilters] = useState(persistedData.filters);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSprintConfigModal, setShowSprintConfigModal] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [viewDensity, setViewDensity] = useState(persistedData.density);
  const [isFiltersPanelCollapsed, setIsFiltersPanelCollapsed] = useState(persistedData.collapsed);
  const [issueStages, setIssueStages] = useState(persistedData.stages);
  const [sprintConfig, setSprintConfig] = useState(persistedData.config);
  const [searchQuery, setSearchQuery] = useState('');
  const [shareToast, setShareToast] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [appModal, setAppModal] = useState(null);

  const showAlert = (title, body, tone = 'info') => setAppModal({ title, body, tone });

  // Check for shared state in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');

    if (shareParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(shareParam))));

        console.log('📥 Loading shared view from link');
        console.log('  Sprint:', decoded.config.name);
        console.log('  Filters:', decoded.filters.length);
        console.log('  Shared on:', new Date(decoded.timestamp).toLocaleString());

        // Store in localStorage for persistence first
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

        // Then restore the shared state to React
        setSprintData(updatedSprintData);
        setSprintConfig(decoded.config);
        setDynamicFilters(decoded.filters);
        setIssueStages(migrateStages(decoded.stages || {}));
        setViewDensity(decoded.viewDensity || 'dense');

        console.log('✅ Shared view restored successfully');

        // Clean up URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);

      } catch (error) {
        console.error('❌ Failed to restore shared state:', error);
        showAlert('Could Not Load Shared View', 'The link may be invalid or corrupted.', 'error');
      }
    }
  }, []); // Run only once on mount

  // Persist sprint-specific data (filters and stages) whenever they change
  useEffect(() => {
    try {
      const sprintKey = getSprintKey(sprintConfig);
      const updatedSprintData = {
        ...sprintData,
        [sprintKey]: {
          filters: dynamicFilters,
          stages: issueStages,
        },
      };
      setSprintData(updatedSprintData);
      localStorage.setItem('sprintTracker_sprintData', JSON.stringify(updatedSprintData));
    } catch (error) {
      console.error('Error saving sprint data:', error);
    }
  }, [dynamicFilters, issueStages, sprintConfig]);

  // Persist sprint config to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('sprintTracker_sprintConfig', JSON.stringify(sprintConfig));
    } catch (error) {
      console.error('Error saving sprint config:', error);
    }
  }, [sprintConfig]);

  // Persist view density to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('sprintTracker_viewDensity', viewDensity);
    } catch (error) {
      console.error('Error saving view density:', error);
    }
  }, [viewDensity]);

  // Persist filters panel collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sprintTracker_filtersPanelCollapsed', isFiltersPanelCollapsed.toString());
    } catch (error) {
      console.error('Error saving filters panel state:', error);
    }
  }, [isFiltersPanelCollapsed]);

  const allFilters = useMemo(() => (
    [...filters, ...dynamicFilters].sort((a, b) => {
      const priorityA = WORKFLOWS[a.workflow || 'feature'].priority;
      const priorityB = WORKFLOWS[b.workflow || 'feature'].priority;
      return priorityA - priorityB;
    })
  ), [dynamicFilters]);

  const issueFilterMap = useMemo(() => {
    const nextIssueFilterMap = new Map();
    allFilters.forEach((filter) => {
      filter.issues?.forEach((issue) => {
        nextIssueFilterMap.set(issue.key, filter);
      });
    });
    return nextIssueFilterMap;
  }, [allFilters]);

  const todayKey = new Date().toDateString();

  const sprintMetrics = useMemo(() => {
    const issues = allFilters.flatMap((filter) => {
      const filterStages = getStagesForFilter(filter);
      const weights = getWeightsForFilter(filter);

      return filter.issues.map((issue) => {
        const issueStageData = issueStages[issue.key];
        const stageCompletion = issueStageData?.stages ?? new Array(filterStages.length).fill(false);
        const completedStages = stageCompletion.filter(Boolean).length;
        const percent = calculateWeightedCompletion(stageCompletion, weights);

        // Determine status based on completion
        let status = issue.status;
        if (percent === 100) {
          status = 'Done';
        } else if (percent === 0) {
          status = 'New';
        } else if (percent > 0) {
          status = 'In Progress';
        }

        return {
          ...issue,
          filter: filter.name,
          accent: filter.accent,
          percent,
          status,
          completedStages,
          workflow: filter.workflow || 'feature', // Add workflow info to issue
        };
      });
    });

    const points = issues.reduce((sum, issue) => sum + issue.points, 0);
    const avgProgress = issues.length > 0
      ? Math.round(issues.reduce((sum, issue) => sum + issue.percent, 0) / issues.length)
      : 0;
    const completedPoints = issues.reduce((sum, issue) => {
      return sum + (issue.points * (issue.percent / 100));
    }, 0);

    const issueHealthStats = issues.map(issue => {
      const filter = issueFilterMap.get(issue.key) || { workflow: 'feature' };
      const filterStages = getStagesForFilter(filter);
      const weights = getWeightsForFilter(filter);
      const issueStageData = issueStages[issue.key];
      const stageCompletion = issueStageData?.stages ?? new Array(filterStages.length).fill(false);
      const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
      const isBlocked = issueStageData?.blocked ?? false;
      return getHealthStatus(completionPercent, isBlocked, sprintConfig);
    });

    const featureIssues = issues.filter(issue => issueFilterMap.get(issue.key)?.workflow === 'feature');
    const featureHealthStats = featureIssues.map(issue => {
      const filter = issueFilterMap.get(issue.key) || { workflow: 'feature' };
      const filterStages = getStagesForFilter(filter);
      const weights = getWeightsForFilter(filter);
      const issueStageData = issueStages[issue.key];
      const stageCompletion = issueStageData?.stages ?? new Array(filterStages.length).fill(false);
      const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
      const isBlocked = issueStageData?.blocked ?? false;
      return getHealthStatus(completionPercent, isBlocked, sprintConfig);
    });

    const countStatuses = (healthStats) => ({
      blocked: healthStats.filter(h => h.status === 'Blocked').length,
      behind: healthStats.filter(h => h.status === 'Behind').length,
      atRisk: healthStats.filter(h => h.status === 'At Risk').length,
      onTrack: healthStats.filter(h => h.status === 'On Track').length,
      ahead: healthStats.filter(h => h.status === 'Ahead').length,
      done: healthStats.filter(h => h.status === 'Done').length,
    });

    const allHealthCounts = countStatuses(issueHealthStats);
    const featureHealthCounts = countStatuses(featureHealthStats);
    const totalFeatureIssues = featureIssues.length;

    let sprintHealth;
    if (totalFeatureIssues === 0) {
      sprintHealth = { status: 'No Data', color: '#9ca3af', icon: '○' };
    } else if (featureHealthCounts.blocked > 0 || featureHealthCounts.behind > totalFeatureIssues * 0.3) {
      sprintHealth = { status: 'Critical', color: '#dc2626', icon: '⚠️' };
    } else if (featureHealthCounts.atRisk + featureHealthCounts.behind > totalFeatureIssues * 0.2) {
      sprintHealth = { status: 'At Risk', color: '#f59e0b', icon: '⚠' };
    } else if (featureHealthCounts.done === totalFeatureIssues) {
      sprintHealth = { status: 'Complete', color: '#16a34a', icon: '✓' };
    } else if (avgProgress >= 90) {
      sprintHealth = { status: 'Excellent', color: '#16a34a', icon: '🎯' };
    } else if (featureHealthCounts.ahead + featureHealthCounts.onTrack > totalFeatureIssues * 0.7) {
      sprintHealth = { status: 'Healthy', color: '#0891b2', icon: '✓' };
    } else {
      sprintHealth = { status: 'Fair', color: '#0891b2', icon: '→' };
    }

    return {
      issues,
      points,
      avgProgress,
      completedPoints,
      sprintHealth,
      totalFeatureIssues,
      blockedCount: allHealthCounts.blocked,
      behindCount: allHealthCounts.behind,
      atRiskCount: allHealthCounts.atRisk,
      riskCount: allHealthCounts.blocked + allHealthCounts.behind + allHealthCounts.atRisk,
      featureBlockedCount: featureHealthCounts.blocked,
      featureOnTrackCount: featureHealthCounts.onTrack,
      featureAheadCount: featureHealthCounts.ahead,
    };
  }, [allFilters, issueFilterMap, issueStages, sprintConfig, todayKey]);

  const {
    issues,
    points,
    avgProgress,
    completedPoints,
    sprintHealth,
    totalFeatureIssues,
    blockedCount,
    behindCount,
    atRiskCount,
    riskCount,
    featureBlockedCount,
    featureOnTrackCount,
    featureAheadCount,
  } = sprintMetrics;

  const visibleFilters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allFilters;
    }

    return allFilters.reduce((matches, filter) => {
      const filterMatches = [
        filter.name,
        filter.jql,
        WORKFLOWS[filter.workflow || 'feature'].name,
      ].some(value => String(value || '').toLowerCase().includes(query));

      const matchingIssues = filter.issues.filter(issue => [
        issue.key,
        issue.title,
        issue.owner,
        issue.type,
        issue.jiraStatus,
      ].some(value => String(value || '').toLowerCase().includes(query)));

      if (filterMatches) {
        matches.push(filter);
      } else if (matchingIssues.length > 0) {
        matches.push({ ...filter, issues: matchingIssues });
      }

      return matches;
    }, []);
  }, [allFilters, searchQuery]);

  const handleAddFilter = async (source) => {
    setLoading(true);
    console.log('Adding source:', source);
    try {
      let filter, issues;

      if (source.type === 'filter') {
        console.log('Fetching filter ID:', source.filterId);
        const result = await fetchFilterIssues(source.filterId);
        filter = result.filter;
        issues = result.issues;
      } else if (source.type === 'jql') {
        // Direct JQL query
        console.log('Fetching JQL:', source.jql);
        const result = await fetchJQLIssues(source.jql, source.name);
        filter = result.filter;
        issues = result.issues;
      }

      const transformedFilter = transformFilter(filter, issues);
      // Add workflow type to the filter
      transformedFilter.workflow = source.workflow || 'feature';
      setDynamicFilters([...dynamicFilters, transformedFilter]);

      // Initialize stage completion for new issues
      const newStages = { ...issueStages };
      const filterStages = getStagesForFilter(transformedFilter);
      transformedFilter.issues.forEach(issue => {
        if (!newStages[issue.key]) {
          newStages[issue.key] = { stages: new Array(filterStages.length).fill(false), blocked: false };
        }
      });
      setIssueStages(newStages);

      setShowAddModal(false);
      setLastSync(new Date());
    } catch (error) {
      showAlert('Failed to Add Source', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFilter = (filterId) => {
    const filterToRemove = dynamicFilters.find(f => f.id === filterId);
    if (filterToRemove) {
      // Remove stage data for issues in this filter
      const newStages = { ...issueStages };
      filterToRemove.issues.forEach(issue => {
        delete newStages[issue.key];
      });
      setIssueStages(newStages);
    }
    setDynamicFilters(dynamicFilters.filter(f => f.id !== filterId));
  };

  const handleSyncAll = async () => {
    setLoading(true);
    console.log('🔄 Starting sync for', dynamicFilters.length, 'filters...');

    try {
      const updatedFilters = await Promise.all(
        dynamicFilters.map(async (filter) => {
          console.log('📡 Syncing filter:', filter.name, filter.jql ? '(JQL)' : `(ID: ${filter.id})`);

          let filterData, issues;

          // Fetch based on filter type (JQL vs Filter ID)
          if (filter.jql) {
            // JQL-based filter
            console.log('  Using JQL:', filter.jql);
            const result = await fetchJQLIssues(filter.jql, filter.name);
            filterData = result.filter;
            issues = result.issues;
            console.log('  ✅ Fetched', issues.length, 'issues via JQL');
          } else {
            // Filter ID-based filter
            console.log('  Using Filter ID:', filter.id);
            const result = await fetchFilterIssues(filter.id);
            filterData = result.filter;
            issues = result.issues;
            console.log('  ✅ Fetched', issues.length, 'issues via Filter ID');
          }

          const transformed = transformFilter(filterData, issues);
          // Preserve the workflow type from the original filter
          transformed.workflow = filter.workflow || 'feature';

          // IMPORTANT: Always use the JQL from Jira, not from local cache!
          // This ensures we pick up any changes made to the filter in Jira
          if (filterData.jql) {
            transformed.jql = filterData.jql;
            console.log('  📝 Updated JQL from Jira:', filterData.jql);
          } else if (filter.jql) {
            // For JQL-only filters (not saved in Jira), keep the original
            transformed.jql = filter.jql;
          }

          return transformed;
        })
      );

      console.log('✅ All filters synced successfully');

      // Track changes for notification
      const oldIssueKeys = new Set(
        dynamicFilters.flatMap(f => f.issues.map(i => i.key))
      );
      const newIssueKeys = new Set(
        updatedFilters.flatMap(f => f.issues.map(i => i.key))
      );

      console.log('📊 Sync comparison:');
      console.log('  Old issue count:', oldIssueKeys.size);
      console.log('  New issue count:', newIssueKeys.size);

      const addedIssues = [...newIssueKeys].filter(key => !oldIssueKeys.has(key));
      const removedIssues = [...oldIssueKeys].filter(key => !newIssueKeys.has(key));

      console.log('  Added:', addedIssues.length, addedIssues.slice(0, 5));
      console.log('  Removed:', removedIssues.length, removedIssues.slice(0, 5));

      // Initialize stages for any new issues
      const newStages = { ...issueStages };
      updatedFilters.forEach(filter => {
        const filterStages = getStagesForFilter(filter);
        filter.issues.forEach(issue => {
          if (!newStages[issue.key]) {
            newStages[issue.key] = { stages: new Array(filterStages.length).fill(false), blocked: false };
          }
        });
      });

      // Remove stages for removed issues
      removedIssues.forEach(key => {
        delete newStages[key];
      });

      // Update state first
      setIssueStages(newStages);
      setDynamicFilters(updatedFilters);
      setLastSync(new Date());

      console.log('💾 Updated filters in state');
      console.log('   New filters:', updatedFilters.map(f => `${f.name}: ${f.issues.length} issues`));

      // Wait a tick for state to update before showing alert
      setTimeout(() => {
        // Show detailed notification about changes
        if (addedIssues.length > 0 || removedIssues.length > 0) {
          const message = [];
          if (addedIssues.length > 0) {
            message.push(`✅ ${addedIssues.length} new issue(s): ${addedIssues.slice(0, 3).join(', ')}${addedIssues.length > 3 ? '...' : ''}`);
          }
          if (removedIssues.length > 0) {
            message.push(`🗑️ ${removedIssues.length} removed issue(s): ${removedIssues.slice(0, 3).join(', ')}${removedIssues.length > 3 ? '...' : ''}`);
          }

          // Also show per-filter breakdown
          const filterBreakdown = updatedFilters.map((filter) => {
            // Find matching old filter by ID (or JQL for JQL-based filters)
            const oldFilter = dynamicFilters.find(f =>
              filter.jql ? (f.jql === filter.jql) : (f.id === filter.id)
            );
            const oldCount = oldFilter ? oldFilter.issues.length : 0;
            const newCount = filter.issues.length;
            const change = newCount - oldCount;
            return `  ${filter.name}: ${oldCount} → ${newCount} (${change >= 0 ? '+' : ''}${change})`;
          }).join('\n');

          showAlert('Sync Completed', `${message.join('\n')}\n\nPer-filter changes:\n${filterBreakdown}`, 'success');
        } else {
          // Still show per-filter info even if no changes detected
          const filterInfo = updatedFilters.map(f =>
            `  ${f.name}: ${f.issues.length} issues`
          ).join('\n');
          showAlert('Sync Completed', `No changes detected.\n\nCurrent state:\n${filterInfo}`, 'success');
        }
      }, 100); // Small delay to ensure state updates

    } catch (error) {
      console.error('❌ Sync failed:', error);

      let errorMessage = `Failed to sync filters:\n\n${error.message}`;

      // Add helpful hints based on error type
      if (error.message.includes('proxy server')) {
        errorMessage += '\n\n💡 Make sure the proxy server is running:\n' +
          'Run: npm run proxy\n' +
          'in a separate terminal';
      } else if (error.message.includes('CORS')) {
        errorMessage += '\n\n💡 CORS issue detected. The proxy server should handle this.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage += '\n\n💡 Filter not found. Check that the filter ID or JQL is correct.';
      }

      showAlert('Sync Failed', errorMessage, 'error');
    } finally {
      setLoading(false);
      console.log('🏁 Sync operation completed');
    }
  };

  const toggleStage = (issueKey, stageIndex, filter) => {
    const filterStages = getStagesForFilter(filter);
    const newStages = { ...issueStages };
    const current = newStages[issueKey] ?? { stages: new Array(filterStages.length).fill(false), blocked: false };
    const stagesArr = [...current.stages];

    stagesArr[stageIndex] = !stagesArr[stageIndex];

    if (stagesArr[stageIndex]) {
      for (let i = 0; i < stageIndex; i++) {
        stagesArr[i] = true;
      }
    } else {
      for (let i = stageIndex + 1; i < filterStages.length; i++) {
        stagesArr[i] = false;
      }
    }

    newStages[issueKey] = { ...current, stages: stagesArr };
    setIssueStages(newStages);
  };

  const toggleBlocked = (issueKey) => {
    const newStages = { ...issueStages };
    const current = newStages[issueKey] ?? { stages: new Array(stages.length).fill(false), blocked: false };
    newStages[issueKey] = { ...current, blocked: !current.blocked };
    setIssueStages(newStages);
  };

  // Calculate sprint duration and days remaining
  const getDaysRemaining = () => {
    const today = new Date();
    const end = new Date(sprintConfig.endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calculate weekly velocity (points completed per week)
  const getWeeklyVelocity = () => {
    const start = new Date(sprintConfig.startDate);
    const today = new Date();
    const end = new Date(sprintConfig.endDate);

    // Calculate total sprint duration in weeks
    const totalDuration = (end - start) / (1000 * 60 * 60 * 24);
    const totalWeeks = Math.ceil(totalDuration / 7);

    // Calculate weeks elapsed
    const elapsed = Math.max(0, today - start);
    const weeksElapsed = Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60 * 24 * 7)));

    // Calculate velocity as completed points per week
    const velocity = weeksElapsed > 0 ? (completedPoints / weeksElapsed).toFixed(1) : 0;

    // Calculate projected completion based on current velocity
    const remainingPoints = points - completedPoints;
    const weeksNeeded = velocity > 0 ? Math.ceil(remainingPoints / velocity) : 0;

    return {
      velocity: parseFloat(velocity),
      weeksElapsed,
      totalWeeks,
      weeksNeeded,
      onTrack: weeksNeeded <= (totalWeeks - weeksElapsed),
      projectedPoints: velocity * totalWeeks,
    };
  };

  const getSprintDuration = () => {
    const start = new Date(sprintConfig.startDate);
    const end = new Date(sprintConfig.endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Share functionality - generate shareable link
  const handleShare = () => {
    const shareData = {
      config: sprintConfig,
      filters: dynamicFilters,
      stages: issueStages,
      viewDensity,
      timestamp: new Date().toISOString(),
    };

    // Unicode-safe encoding (btoa only handles Latin-1)
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))));
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareToast('Shareable link copied to clipboard');
      setTimeout(() => setShareToast(''), 3000);
    }).catch(() => {
      setAppModal({ title: 'Share Link', body: 'Clipboard access was blocked. Copy the link below:', copyUrl: shareUrl });
    });
  };

  // Export functionality (PDF or Image)
  const handleExport = async (format = 'pdf') => {
    try {
      setLoading(true);
      setShowExportMenu(false);

      const html2canvas = (await import('html2canvas')).default;
      const velocity = getWeeklyVelocity();
      const inProgressIssues = issues.filter(i => i.percent > 0 && i.percent < 100);
      const completedIssues  = issues.filter(i => i.percent === 100);
      const notStartedIssues = issues.filter(i => i.percent === 0);

      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const pdfContainer = document.createElement('div');
      pdfContainer.style.cssText = 'position:absolute;left:-9999px;width:1200px;background:#fff;padding:48px;';
      document.body.appendChild(pdfContainer);

      pdfContainer.innerHTML = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">

          <!-- HEADER -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;padding-bottom:24px;border-bottom:3px solid #00BFA5;">
            <div>
              <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00BFA5;margin-bottom:6px;">Sprint Report</div>
              <h1 style="font-size:38px;font-weight:800;color:#0B1620;margin:0 0 6px;">${sprintConfig.name}</h1>
              <p style="font-size:15px;color:#64748b;margin:0;">${formatDate(sprintConfig.startDate)} – ${formatDate(sprintConfig.endDate)}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;color:#94a3b8;">Generated on</div>
              <div style="font-size:14px;font-weight:600;color:#334155;">${date}</div>
            </div>
          </div>

          <!-- THIS WEEK'S UPDATE -->
          <div style="margin-bottom:40px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00BFA5;margin-bottom:12px;">This Week's Update — Week ${velocity.weeksElapsed} of ${velocity.totalWeeks}</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
              <div style="background:#f0fdf4;border-radius:12px;padding:18px;border-top:3px solid #10b981;">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Week</div>
                <div style="font-size:28px;font-weight:800;color:#0B1620;">${velocity.weeksElapsed} / ${velocity.totalWeeks}</div>
                <div style="font-size:12px;color:#64748b;">${velocity.onTrack ? '✓ On track' : '⚠ Behind pace'}</div>
              </div>
              <div style="background:#eff6ff;border-radius:12px;padding:18px;border-top:3px solid #3b82f6;">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Velocity</div>
                <div style="font-size:28px;font-weight:800;color:#0B1620;">${velocity.velocity} pts</div>
                <div style="font-size:12px;color:#64748b;">per week · ${velocity.weeksNeeded}w needed</div>
              </div>
              <div style="background:#f0fdf4;border-radius:12px;padding:18px;border-top:3px solid #00BFA5;">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">In Progress</div>
                <div style="font-size:28px;font-weight:800;color:#0B1620;">${inProgressIssues.length}</div>
                <div style="font-size:12px;color:#64748b;">of ${issues.length} issues</div>
              </div>
              <div style="background:${blockedCount > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:12px;padding:18px;border-top:3px solid ${blockedCount > 0 ? '#ef4444' : '#10b981'};">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Blocked</div>
                <div style="font-size:28px;font-weight:800;color:${blockedCount > 0 ? '#ef4444' : '#0B1620'};">${blockedCount}</div>
                <div style="font-size:12px;color:#64748b;">${behindCount} behind · ${atRiskCount} at risk</div>
              </div>
            </div>

            <!-- Per-filter this week -->
            <div style="display:grid;grid-template-columns:repeat(${Math.min(allFilters.length, 3)},1fr);gap:12px;">
              ${allFilters.map(filter => {
                const fi = issues.filter(i => i.filter === filter.name);
                const active = fi.filter(i => i.percent > 0 && i.percent < 100).length;
                const done   = fi.filter(i => i.percent === 100).length;
                const fp     = fi.reduce((s, i) => s + i.points, 0);
                const fc     = fi.reduce((s, i) => s + (i.points * i.percent / 100), 0);
                const fpct   = fp > 0 ? Math.round((fc / fp) * 100) : 0;
                return `
                  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;border-left:4px solid ${filter.accent};">
                    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${filter.name}</div>
                    <div style="font-size:11px;color:#64748b;margin-bottom:8px;">${done} done · ${active} active · ${fi.length} total</div>
                    <div style="background:#e2e8f0;height:6px;border-radius:999px;overflow:hidden;">
                      <div style="background:${filter.accent};height:100%;width:${fpct}%;border-radius:999px;"></div>
                    </div>
                    <div style="font-size:12px;font-weight:700;color:#111827;margin-top:5px;">${fpct}%</div>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <!-- OVERALL METRICS -->
          <div style="margin-bottom:40px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00BFA5;margin-bottom:12px;">Overall Sprint Metrics</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
              <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:22px;border-radius:14px;border-left:4px solid ${sprintHealth.color};">
                <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">SPRINT HEALTH</div>
                <div style="font-size:32px;font-weight:800;color:#111827;margin-bottom:4px;">${sprintHealth.status}</div>
                <div style="font-size:12px;color:#64748b;">${featureAheadCount + featureOnTrackCount}/${totalFeatureIssues} features on track</div>
              </div>
              <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);padding:22px;border-radius:14px;border-left:4px solid #3b82f6;">
                <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">COMPLETION</div>
                <div style="font-size:32px;font-weight:800;color:#111827;margin-bottom:4px;">${avgProgress}%</div>
                <div style="font-size:12px;color:#64748b;">${Math.round(completedPoints)} / ${points} story points</div>
              </div>
              <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);padding:22px;border-radius:14px;border-left:4px solid #f59e0b;">
                <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">PROJECTED</div>
                <div style="font-size:32px;font-weight:800;color:#111827;margin-bottom:4px;">${Math.round(velocity.projectedPoints)} pts</div>
                <div style="font-size:12px;color:#64748b;">by end of sprint</div>
              </div>
            </div>
          </div>

          <!-- WORK BREAKDOWN -->
          <div style="margin-bottom:40px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00BFA5;margin-bottom:12px;">Work Breakdown by Filter</div>
            ${allFilters.map(filter => {
              const filterIssues  = issues.filter(i => i.filter === filter.name);
              const filterPoints  = filterIssues.reduce((s, i) => s + i.points, 0);
              const filterDone    = filterIssues.reduce((s, i) => s + (i.points * i.percent / 100), 0);
              const filterPct     = filterPoints > 0 ? Math.round((filterDone / filterPoints) * 100) : 0;
              const filterStages  = getStagesForFilter(filter);
              return `
                <div style="background:#f8fafc;border-radius:12px;margin-bottom:14px;overflow:hidden;border:1px solid #e2e8f0;">
                  <!-- filter header -->
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-left:5px solid ${filter.accent};">
                    <div>
                      <div style="font-size:17px;font-weight:700;color:#111827;">${filter.name}</div>
                      <div style="font-size:12px;color:#64748b;margin-top:2px;">${WORKFLOWS[filter.workflow || 'feature'].name} · ${filterIssues.length} issues</div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:26px;font-weight:800;color:#111827;">${filterPct}%</div>
                      <div style="font-size:12px;color:#64748b;">${Math.round(filterDone)} / ${filterPoints} pts</div>
                    </div>
                  </div>
                  <!-- progress bar -->
                  <div style="background:#e2e8f0;height:6px;">
                    <div style="background:${filter.accent};height:100%;width:${filterPct}%;"></div>
                  </div>
                  <!-- issue table -->
                  <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead>
                      <tr style="background:#f1f5f9;">
                        <th style="padding:8px 12px;text-align:left;font-weight:700;color:#64748b;width:90px;">KEY</th>
                        <th style="padding:8px 12px;text-align:left;font-weight:700;color:#64748b;">TITLE</th>
                        <th style="padding:8px 12px;text-align:center;font-weight:700;color:#64748b;width:70px;">PROGRESS</th>
                        <th style="padding:8px 12px;text-align:center;font-weight:700;color:#64748b;width:90px;">STAGES</th>
                        <th style="padding:8px 12px;text-align:center;font-weight:700;color:#64748b;width:80px;">HEALTH</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filterIssues.map((issue, idx) => {
                        const stageData = issueStages[issue.key];
                        const stagesArr = stageData?.stages ?? new Array(filterStages.length).fill(false);
                        const doneStages = stagesArr.filter(Boolean).length;
                        const health = getHealthStatus(issue.percent, stageData?.blocked ?? false, sprintConfig);
                        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                        const pctColor = issue.percent === 100 ? '#10b981' : issue.percent > 0 ? '#3b82f6' : '#94a3b8';
                        return `
                          <tr style="background:${rowBg};border-top:1px solid #f1f5f9;">
                            <td style="padding:9px 12px;font-family:monospace;font-weight:600;color:#00917A;">${issue.key}</td>
                            <td style="padding:9px 12px;color:#111827;max-width:300px;">${issue.title.length > 60 ? issue.title.substring(0,60)+'…' : issue.title}</td>
                            <td style="padding:9px 12px;text-align:center;font-weight:700;color:${pctColor};">${issue.percent}%</td>
                            <td style="padding:9px 12px;text-align:center;color:#64748b;">${doneStages} / ${filterStages.length}</td>
                            <td style="padding:9px 12px;text-align:center;">
                              <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:${health.bgColor};color:${health.color};border:1px solid ${health.borderColor};">${health.status}</span>
                            </td>
                          </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>`;
            }).join('')}
          </div>

          <!-- RISK SUMMARY -->
          <div style="background:${riskCount > 0 ? '#fef2f2' : '#f0fdf4'};padding:24px;border-radius:14px;border-left:5px solid ${riskCount > 0 ? '#ef4444' : '#10b981'};margin-bottom:40px;">
            <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:16px;">Risk Summary</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
              <div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Blocked</div><div style="font-size:28px;font-weight:800;color:#ef4444;">${blockedCount}</div></div>
              <div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Behind</div><div style="font-size:28px;font-weight:800;color:#f59e0b;">${behindCount}</div></div>
              <div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">At Risk</div><div style="font-size:28px;font-weight:800;color:#f97316;">${atRiskCount}</div></div>
            </div>
          </div>

          <!-- FOOTER -->
          <div style="padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#94a3b8;font-size:12px;">
            <span>Sprint Tracker · Tekion Corp</span>
            <span>${date}</span>
          </div>
        </div>
      `;

      const canvas = await html2canvas(pdfContainer, { scale: 2, logging: false, backgroundColor: '#ffffff' });
      document.body.removeChild(pdfContainer);

      const baseName = `${sprintConfig.name.replace(/\s+/g, '_')}_Week${velocity.weeksElapsed}_Report_${new Date().toISOString().split('T')[0]}`;

      if (format === 'image') {
        const link = document.createElement('a');
        link.download = `${baseName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setShareToast('Image exported successfully');
        setTimeout(() => setShareToast(''), 3000);
      } else {
        const { jsPDF } = await import('jspdf');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${baseName}.pdf`);
        setShareToast('PDF exported successfully');
        setTimeout(() => setShareToast(''), 3000);
      }

    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show simplified welcome state when no filters
  const showWelcomeState = dynamicFilters.length === 0;

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
      {showWelcomeState ? (
        // Compact welcome header for executive-friendly first impression
        <section className="hero-panel welcome">
          <div className="welcome-content">
            <h1>Sprint Tracker</h1>
            <p className="welcome-description">Track delivery progress across multiple Jira filters with real-time visibility</p>

            {/* Show current sprint config if set */}
            {sprintConfig && (
              <div className="welcome-sprint-info">
                <span className="sprint-badge">
                  {sprintConfig.name} • {formatDate(sprintConfig.startDate)} - {formatDate(sprintConfig.endDate)}
                </span>
              </div>
            )}

            <div className="welcome-actions">
              <button className="btn btn-on-dark btn-primary-on-dark primary-button large" onClick={() => setShowAddModal(true)}>
                <Plus size={18} />
                Add Jira Filter to Get Started
              </button>
              <button className="btn btn-on-dark secondary-button" onClick={() => setShowSprintConfigModal(true)}>
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
      ) : (
        // Full header when data is loaded
        <section className="hero-panel">
          <div>
            <p className="eyebrow">{sprintConfig.name} · {formatDate(sprintConfig.startDate)} - {formatDate(sprintConfig.endDate)}</p>
            <h1>Multi-filter sprint planner</h1>
            <p className="hero-copy">
              A single operating view for roadmap, support, tech debt, and AI Jira filters with status, blockers, completion, and stage-by-stage delivery visibility.
              <span className={`days-remaining ${getDaysRemaining() < 3 ? 'urgent' : ''}`}>
                {getDaysRemaining() > 0 ? `${getDaysRemaining()} days remaining` : getDaysRemaining() === 0 ? 'Last day!' : 'Sprint ended'}
              </span>
            </p>
          </div>

          <div className="hero-actions">
            <button
              className="btn btn-on-dark btn-sm"
              onClick={() => setViewDensity(viewDensity === 'dense' ? 'relaxed' : 'dense')}
              title={viewDensity === 'dense' ? 'Switch to Relaxed View' : 'Switch to Dense View'}
            >
              <SlidersHorizontal size={16} /> {viewDensity === 'dense' ? 'Relaxed' : 'Dense'}
            </button>
            <button className="btn btn-on-dark btn-sm" onClick={() => setShowSprintConfigModal(true)}>
              <Clock3 size={16} /> Configure Sprint
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-on-dark btn-sm"
                onClick={() => setShowExportMenu(v => !v)}
                disabled={loading || dynamicFilters.length === 0}
              >
                <Download size={16} /> Export ▾
              </button>
              {showExportMenu && (
                <div className="export-dropdown">
                  <button onClick={() => handleExport('pdf')}>Export as PDF</button>
                  <button onClick={() => handleExport('image')}>Export as Image (PNG)</button>
                </div>
              )}
            </div>
            <button
              className="btn btn-on-dark btn-sm"
              onClick={handleShare}
              disabled={dynamicFilters.length === 0}
            >
              <Link2 size={16} /> Share View
            </button>
          </div>
        </section>
      )}

      {appModal && <AppAlertModal modal={appModal} onClose={() => setAppModal(null)} />}
      {showAddModal && <AddFilterModal onAdd={handleAddFilter} onClose={() => setShowAddModal(false)} loading={loading} />}
      {showSprintConfigModal && (
        <SprintConfigModal
          config={sprintConfig}
          onSave={(newConfig) => {
            // Load data for the new sprint
            const newSprintKey = getSprintKey(newConfig);
            const newSprintData = sprintData[newSprintKey] || { filters: [], stages: {} };

            // Update sprint config and load its data
            setSprintConfig(newConfig);
            setDynamicFilters(newSprintData.filters);
            setIssueStages(newSprintData.stages);
            setShowSprintConfigModal(false);
          }}
          onClose={() => setShowSprintConfigModal(false)}
        />
      )}

      {!showWelcomeState && (
        <>
          <section className="metric-grid" aria-label="Sprint summary metrics">
            <Metric
              tone="success"
              label="Sprint Health"
              value={sprintHealth.status}
              detail={`${featureAheadCount + featureOnTrackCount}/${totalFeatureIssues} features on track · ${featureBlockedCount} blocked`}
              icon={<CheckCircle2 size={16} />}
            />
            <Metric
              label="Issues in scope"
              value={issues.length}
              detail={`${points} total story points`}
              icon={<Link2 size={16} />}
            />
            <Metric
              tone="brand"
              label="Completion"
              value={`${avgProgress}%`}
              detail={`${Math.round(completedPoints)}/${points} weighted story points`}
              icon={<CheckCircle2 size={16} />}
            />
            <VelocityMetric velocity={getWeeklyVelocity()} totalPoints={points} completedPoints={completedPoints} />
            <Metric
              tone={riskCount > 0 ? 'warn' : null}
              label="At-risk work"
              value={riskCount}
              detail={`${atRiskCount} at risk · ${behindCount} behind · ${blockedCount} blocked`}
              icon={<AlertTriangle size={16} />}
            />
          </section>

          <section className={`workspace-grid ${isFiltersPanelCollapsed ? 'filters-collapsed' : ''}`}>
            <aside className={`filter-panel ${isFiltersPanelCollapsed ? 'collapsed' : ''}`}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Connected JQL</p>
                  <h2>Jira filters</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="icon-button"
                    onClick={() => setIsFiltersPanelCollapsed(!isFiltersPanelCollapsed)}
                    aria-label={isFiltersPanelCollapsed ? 'Expand filters' : 'Collapse filters'}
                    title={isFiltersPanelCollapsed ? 'Expand filters panel' : 'Collapse filters panel'}
                  >
                    {isFiltersPanelCollapsed ? '→' : '←'}
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setShowAddModal(true)}
                    aria-label="Add filter"
                    title="Add Jira filter"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {!isFiltersPanelCollapsed && (
                <>
                  <label className="search-box">
                    <Search size={17} />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search filters, owners, keys"
                    />
                  </label>

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
                      visibleFilters.map((filter) => {
                        const totalPts = filter.issues.reduce((sum, issue) => sum + issue.points, 0);
                        const donePts  = filter.issues.reduce((sum, issue) => sum + (issue.percent === 100 ? issue.points : 0), 0);
                        const pct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
                        return (
                          <article
                            className="filter-card"
                            key={filter.id}
                            style={{ '--accent': filter.accent }}
                            onClick={() => document.getElementById(`filter-section-${filter.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          >
                            <div className="filter-card-title">
                              <span className="filter-dot" />
                              <strong>{filter.name}</strong>
                              <button
                                className="remove-filter-btn"
                                onClick={() => handleRemoveFilter(filter.id)}
                                aria-label="Remove filter"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p title={filter.jql}>
                              {filter.jql && filter.jql.length > 80
                                ? `${filter.jql.substring(0, 80)}…`
                                : filter.jql}
                            </p>
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

            <section className="planner-panel">
              <div className="panel-heading planner-heading">
                <div>
                  <p className="eyebrow">Delivery matrix</p>
                  <h2>Sprint status by delivery stage</h2>
                  {allFilters.length > 0 && (
                    <small style={{ color: 'var(--fg-3)', fontWeight: 600, marginTop: '4px', display: 'block', fontSize: '12px' }}>
                      Click any stage cell to mark it complete or incomplete
                    </small>
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
                  <>
                    {visibleFilters.map((filter) => {
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
                              issue={issue}
                              filter={filter}
                              key={issue.key}
                              stageCompletion={issueStages[issue.key]?.stages ?? new Array(filterStages.length).fill(false)}
                              isBlocked={issueStages[issue.key]?.blocked ?? false}
                              onToggleStage={toggleStage}
                              onToggleBlocked={toggleBlocked}
                              sprintConfig={sprintConfig}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </section>
          </section>
        </>
      )}

      {shareToast && <div className="share-toast">{shareToast}</div>}
    </main>
    </div>
  );
};

function AppAlertModal({ modal, onClose }) {
  const { title, body, tone = 'info', copyUrl } = modal;
  const accentColor = { error: 'var(--danger)', success: 'var(--success)', warning: 'var(--warning)', info: 'var(--brand-teal)' }[tone] || 'var(--brand-teal)';

  const handleCopy = () => {
    navigator.clipboard.writeText(copyUrl).then(onClose);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content app-alert-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderTop: `3px solid ${accentColor}` }}>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="app-alert-body">
          {body && <p className="app-alert-text">{body}</p>}
          {copyUrl && (
            <div className="app-alert-copy-row">
              <input
                readOnly
                value={copyUrl}
                className="app-alert-copy-input"
                onFocus={e => e.target.select()}
              />
              <button className="btn btn-primary btn-sm" onClick={handleCopy}>Copy</button>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary btn-sm" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

function AddFilterModal({ onAdd, onClose, loading }) {
  const [sourceType, setSourceType] = useState('filter'); // 'filter' or 'jql'
  const [filterId, setFilterId] = useState('');
  const [jqlQuery, setJqlQuery] = useState('');
  const [filterName, setFilterName] = useState('');
  const [workflow, setWorkflow] = useState('feature'); // 'feature' or 'support'
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
      onAdd({
        type: 'jql',
        jql: jqlQuery.trim(),
        name: filterName.trim(),
        workflow
      });
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
                <input
                  type="radio"
                  name="workflow"
                  value="feature"
                  checked={workflow === 'feature'}
                  onChange={(e) => setWorkflow(e.target.value)}
                  disabled={loading}
                />
                <span>Feature Development (10 stages)</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="workflow"
                  value="support"
                  checked={workflow === 'support'}
                  onChange={(e) => setWorkflow(e.target.value)}
                  disabled={loading}
                />
                <span>Support Bugs (4 stages)</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="workflow"
                  value="techdebt"
                  checked={workflow === 'techdebt'}
                  onChange={(e) => setWorkflow(e.target.value)}
                  disabled={loading}
                />
                <span>Tech Debt (4 stages)</span>
              </label>
            </div>
            <small style={{ marginTop: '8px', display: 'block', color: '#6b7280' }}>
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
                <input
                  type="radio"
                  name="sourceType"
                  value="filter"
                  checked={sourceType === 'filter'}
                  onChange={(e) => setSourceType(e.target.value)}
                  disabled={loading}
                />
                <span>Filter ID</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="sourceType"
                  value="jql"
                  checked={sourceType === 'jql'}
                  onChange={(e) => setSourceType(e.target.value)}
                  disabled={loading}
                />
                <span>JQL Query</span>
              </label>
            </div>
          </div>

          {sourceType === 'filter' && (
            <div className="form-group">
              <label htmlFor="filterId">Filter ID</label>
              <input
                id="filterId"
                type="text"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                placeholder="e.g., 65834"
                disabled={loading}
                autoFocus
              />
              <small>Enter the numeric filter ID from your Jira filter URL</small>
            </div>
          )}

          {sourceType === 'jql' && (
            <>
              <div className="form-group">
                <label htmlFor="filterName">Filter Name</label>
                <input
                  id="filterName"
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="e.g., DR_GM Support Issues"
                  disabled={loading}
                  autoFocus
                />
                <small>Give this filter a descriptive name</small>
              </div>

              <div className="form-group">
                <label htmlFor="jqlQuery">JQL Query</label>
                <textarea
                  id="jqlQuery"
                  rows="4"
                  value={jqlQuery}
                  onChange={(e) => setJqlQuery(e.target.value)}
                  placeholder="e.g., project = DR_GM AND status != Done"
                  disabled={loading}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
                <small>Enter the JQL query to fetch issues</small>
              </div>
            </>
          )}



          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SprintConfigModal({ config, onSave, onClose }) {
  const [configMode, setConfigMode] = useState('gates'); // 'gates' or 'manual'
  const [selectedGate, setSelectedGate] = useState('');
  const [sprintName, setSprintName] = useState(config.name);
  const [startDate, setStartDate] = useState(config.startDate);
  const [endDate, setEndDate] = useState(config.endDate);
  const [releaseDate, setReleaseDate] = useState(config.releaseDate || '');
  const [error, setError] = useState('');

  const handleGateSelect = (gateKey) => {
    setSelectedGate(gateKey);
    const gate = SPRINT_GATES[gateKey];
    setSprintName(gate.name);
    setStartDate(gate.developmentStart);
    setEndDate(gate.developmentEnd);
    setReleaseDate(gate.releaseDate);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!sprintName.trim()) {
      setError('Please enter a sprint name');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      setError('End date must be after start date');
      return;
    }

    setError('');
    onSave({
      name: sprintName.trim(),
      startDate,
      endDate,
      releaseDate,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Sprint</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Configuration Mode Selection */}
          <div className="form-group">
            <label style={{ marginBottom: '12px', fontSize: '0.95rem', fontWeight: '700' }}>Configuration Mode</label>
            <div className="radio-group" style={{ gap: '12px' }}>
              <label className="radio-label" style={{ padding: '14px 16px' }}>
                <input
                  type="radio"
                  name="configMode"
                  value="gates"
                  checked={configMode === 'gates'}
                  onChange={(e) => setConfigMode(e.target.value)}
                />
                <span>
                  <strong style={{ fontSize: '0.95rem' }}>Release Gates</strong>
                  <small style={{ display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '0.8rem' }}>
                    Auto-configure from GM calendar
                  </small>
                </span>
              </label>
              <label className="radio-label" style={{ padding: '14px 16px' }}>
                <input
                  type="radio"
                  name="configMode"
                  value="manual"
                  checked={configMode === 'manual'}
                  onChange={(e) => setConfigMode(e.target.value)}
                />
                <span>
                  <strong style={{ fontSize: '0.95rem' }}>Manual Dates</strong>
                  <small style={{ display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '0.8rem' }}>
                    Set custom dates
                  </small>
                </span>
              </label>
            </div>
          </div>

          {/* Gate Selection (if gates mode) */}
          {configMode === 'gates' && (
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label htmlFor="gateSelect" style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '10px' }}>
                Select Release Month
              </label>
              <select
                id="gateSelect"
                value={selectedGate}
                onChange={(e) => handleGateSelect(e.target.value)}
                className="gate-select"
                autoFocus
              >
                <option value="">Choose a release month...</option>
                {Object.keys(SPRINT_GATES).map((key) => {
                  const gate = SPRINT_GATES[key];
                  const startFormatted = new Date(gate.developmentStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const endFormatted = new Date(gate.developmentEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <option key={key} value={key}>
                      {gate.name} • Dev: {startFormatted} - {endFormatted}
                    </option>
                  );
                })}
              </select>
              <small style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                ✨ Dates auto-fill from GM release calendar
              </small>
            </div>
          )}

          {/* Sprint Details (always shown) */}
          <div className="form-group" style={{ marginTop: '24px' }}>
            <label htmlFor="sprintName" style={{ fontSize: '0.95rem', fontWeight: '700' }}>
              Sprint Name {configMode === 'gates' && selectedGate && <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '6px' }}>✓ Auto-filled</span>}
            </label>
            <input
              id="sprintName"
              type="text"
              value={sprintName}
              onChange={(e) => setSprintName(e.target.value)}
              placeholder="e.g., June 2026 Release"
              autoFocus={configMode === 'manual'}
              disabled={configMode === 'gates' && !selectedGate}
            />
            <small style={{ fontSize: '0.8rem', color: '#6b7280' }}>Give your sprint a descriptive name</small>
          </div>

          <div className="form-group">
            <label htmlFor="startDate" style={{ fontSize: '0.95rem', fontWeight: '700' }}>
              Development Start Date {configMode === 'gates' && selectedGate && <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '6px' }}>✓ Auto-filled</span>}
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={configMode === 'gates'}
            />
            <small style={{ fontSize: '0.8rem', color: '#6b7280' }}>When development work begins</small>
          </div>

          <div className="form-group">
            <label htmlFor="endDate" style={{ fontSize: '0.95rem', fontWeight: '700' }}>
              Development End Date {configMode === 'gates' && selectedGate && <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '6px' }}>✓ Auto-filled</span>}
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={configMode === 'gates'}
            />
            <small style={{ fontSize: '0.8rem', color: '#6b7280' }}>When code should be complete on preprod</small>
          </div>

          {releaseDate && (
            <div className="form-group">
              <label htmlFor="releaseDate" style={{ fontSize: '0.95rem', fontWeight: '700' }}>
                Release Date {configMode === 'gates' && selectedGate && <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '6px' }}>✓ Auto-filled</span>}
              </label>
              <input
                id="releaseDate"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                disabled={configMode === 'gates'}
              />
              <small style={{ fontSize: '0.8rem', color: '#6b7280' }}>Production release date</small>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
