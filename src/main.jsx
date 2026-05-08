import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Clock3, Download, Filter, Link2, Plus, RefreshCcw, Search, SlidersHorizontal, TrendingUp, X } from 'lucide-react';
import './styles.css';
import { fetchFilterIssues, fetchJQLIssues, transformFilter } from './jiraService.js';

// ┌─────────────────────────────────────────────┐
// │ EARLY STAGES (Heavy effort - 80%)          │
// ├─────────────────────────────────────────────┤
// │ 1. PM clarification          → 15%  ████████│
// │ 2. HLD/LLD                   → 20%  ██████████│
// │ 3. API contracts             → 15%  ████████│
// │ 4. Working APIs              → 15%  ████████│
// │ 5. FE integration            → 15%  ████████│
// ├─────────────────────────────────────────────┤
// │ LATER STAGES (Lighter effort - 20%)        │
// ├─────────────────────────────────────────────┤
// │ 6. E2E testing               → 8%   ████    │
// │ 7. QA/PM demo                → 5%   ██      │
// │ 8. PR approved               → 3%   █       │
// │ 9. Release ready             → 2%   █       │
// │ 10. 1st Stage Env deployment → 2%   █       │
// └─────────────────────────────────────────────┘
// Workflow definitions with weighted stages
const WORKFLOWS = {
  feature: {
    name: 'Feature Development',
    priority: 1, // Display first
    stages: [
      'PM clarification',
      'HLD/LLD',
      'API contracts',
      'Working APIs',
      'FE integration',
      'E2E testing',
      'QA/PM demo',
      'PR approved',
      'Release ready',
      '1st Stage Env deployment',
    ],
    // Weights representing relative effort/time for each stage
    // Early stages (1-5) are more time-consuming than later stages (6-10)
    weights: [
      15, // PM clarification - heavy upfront planning
      20, // HLD/LLD - most time-consuming design phase
      15, // API contracts - detailed specification
      15, // Working APIs - core development
      15, // FE integration - significant implementation
      8,  // E2E testing - testing phase
      5,  // QA/PM demo - demo and feedback
      3,  // PR approved - quick review
      2,  // Release ready - final prep
      2,  // 1st Stage Env deployment - deployment
    ] // Total: 100
  },
  support: {
    name: 'Support Bugs',
    priority: 2, // Display second
    stages: [
      'Triaged',
      'In Progress',
      'Code Review',
      'In QA',
    ],
    // Support bugs: Triage and fixing take most time
    weights: [20, 60, 15, 5] // Total: 100
  },
  techdebt: {
    name: 'Tech Debt',
    priority: 3, // Display third
    stages: [
      'Triaged',
      'In Progress',
      'Code Review',
      'In QA',
    ],
    // Tech debt: Implementation heavy
    weights: [15, 65, 15, 5] // Total: 100
  }
};

// Legacy support - default to feature workflow
const stages = WORKFLOWS.feature.stages;

// Helper function to get stages for a filter
function getStagesForFilter(filter) {
  const workflow = filter.workflow || 'feature';
  return WORKFLOWS[workflow].stages;
}

// Helper function to get weights for a filter
function getWeightsForFilter(filter) {
  const workflow = filter.workflow || 'feature';
  return WORKFLOWS[workflow].weights;
}

// Calculate weighted completion percentage
function calculateWeightedCompletion(stageCompletion, weights) {
  if (!weights || weights.length !== stageCompletion.length) {
    // Fallback to equal weights if weights not defined
    return Math.round((stageCompletion.filter(Boolean).length / stageCompletion.length) * 100);
  }

  let totalWeight = 0;
  let completedWeight = 0;

  stageCompletion.forEach((completed, index) => {
    const weight = weights[index] || 0;
    totalWeight += weight;
    if (completed) {
      completedWeight += weight;
    }
  });

  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
}

// Calculate health status based on progress vs timeline
function getHealthStatus(completionPercent, isBlocked, sprintConfig) {
  // If manually marked as blocked
  if (isBlocked) {
    return {
      status: 'Blocked',
      color: '#ef4444',
      borderColor: '#dc2626',
      bgColor: '#fef2f2',
      icon: '⊗'
    };
  }

  // Calculate expected progress based on time elapsed
  const today = new Date();
  const startDate = new Date(sprintConfig.startDate);
  const endDate = new Date(sprintConfig.endDate);
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
  const elapsedDays = (today - startDate) / (1000 * 60 * 60 * 24);
  const expectedProgress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));

  // Determine health based on actual vs expected progress
  const progressDelta = completionPercent - expectedProgress;

  if (completionPercent === 100) {
    return {
      status: 'Done',
      color: '#10b981',
      borderColor: '#059669',
      bgColor: '#ecfdf5',
      icon: '✓'
    };
  } else if (completionPercent === 0 && expectedProgress < 5) {
    // Only show "Not Started" if we're very early in the sprint (< 5% time elapsed)
    return {
      status: 'Not Started',
      color: '#6b7280',
      borderColor: '#9ca3af',
      bgColor: '#f9fafb',
      icon: '○'
    };
  } else if (progressDelta >= 10) {
    return {
      status: 'Ahead',
      color: '#10b981',
      borderColor: '#059669',
      bgColor: '#ecfdf5',
      icon: '↗'
    };
  } else if (progressDelta >= -10) {
    return {
      status: 'On Track',
      color: '#3b82f6',
      borderColor: '#2563eb',
      bgColor: '#eff6ff',
      icon: '→'
    };
  } else if (progressDelta >= -25) {
    return {
      status: 'At Risk',
      color: '#f59e0b',
      borderColor: '#d97706',
      bgColor: '#fffbeb',
      icon: '⚠'
    };
  } else {
    return {
      status: 'Behind',
      color: '#ef4444',
      borderColor: '#dc2626',
      bgColor: '#fef2f2',
      icon: '↓'
    };
  }
}

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

function App() {
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
        stages: currentSprintData.stages,
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

  // Check for shared state in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');

    if (shareParam) {
      try {
        const decoded = JSON.parse(atob(shareParam));

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
            stages: decoded.stages,
          },
        };
        localStorage.setItem('sprintTracker_sprintData', JSON.stringify(updatedSprintData));
        localStorage.setItem('sprintTracker_sprintConfig', JSON.stringify(decoded.config));
        localStorage.setItem('sprintTracker_viewDensity', decoded.viewDensity || 'dense');

        // Then restore the shared state to React
        setSprintData(updatedSprintData);
        setSprintConfig(decoded.config);
        setDynamicFilters(decoded.filters);
        setIssueStages(decoded.stages);
        setViewDensity(decoded.viewDensity || 'dense');

        console.log('✅ Shared view restored successfully');

        // Clean up URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);

      } catch (error) {
        console.error('❌ Failed to restore shared state:', error);
        alert('⚠️ Could not load shared view. The link may be invalid or corrupted.');
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

  // Combine static mock filters with dynamic Jira filters and sort by workflow priority
  const allFilters = [...filters, ...dynamicFilters].sort((a, b) => {
    const priorityA = WORKFLOWS[a.workflow || 'feature'].priority;
    const priorityB = WORKFLOWS[b.workflow || 'feature'].priority;
    return priorityA - priorityB;
  });

  // Update getAllIssues to use allFilters and calculate progress from stage completion
  function getAllIssuesFromFilters() {
    return allFilters.flatMap((filter) => {
      const filterStages = getStagesForFilter(filter);
      const weights = getWeightsForFilter(filter);

      return filter.issues.map((issue) => {
        const stageCompletion = issueStages[issue.key] || new Array(filterStages.length).fill(false);
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
  }

  const issues = getAllIssuesFromFilters();
  const points = issues.reduce((sum, issue) => sum + issue.points, 0);

  // Calculate completion based on average stage completion percentage
  const avgProgress = issues.length > 0 ? Math.round(issues.reduce((sum, issue) => sum + issue.percent, 0) / issues.length) : 0;

  // Calculate completed points based on weighted completion
  const completedPoints = issues.reduce((sum, issue) => {
    return sum + (issue.points * (issue.percent / 100));
  }, 0);

  // Calculate sprint-level health based on FEATURE tickets only
  // Support bugs and tech debt are tracked separately and don't impact sprint health
  const featureIssues = issues.filter(issue => {
    const filter = allFilters.find(f => f.issues && f.issues.some(i => i.key === issue.key));
    return filter && filter.workflow === 'feature';
  });

  const featureHealthStats = featureIssues.map(issue => {
    const filter = allFilters.find(f => f.issues && f.issues.some(i => i.key === issue.key));
    const filterStages = getStagesForFilter(filter || { workflow: 'feature' });
    const weights = getWeightsForFilter(filter || { workflow: 'feature' });
    const stageCompletion = issueStages[issue.key] || new Array(filterStages.length).fill(false);
    const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
    const isBlocked = stageCompletion.blocked || false;
    return getHealthStatus(completionPercent, isBlocked, sprintConfig);
  });

  // Calculate all issue health stats for the "At-risk work" metric
  const issueHealthStats = issues.map(issue => {
    const filter = allFilters.find(f => f.issues && f.issues.some(i => i.key === issue.key));
    const filterStages = getStagesForFilter(filter || { workflow: 'feature' });
    const weights = getWeightsForFilter(filter || { workflow: 'feature' });
    const stageCompletion = issueStages[issue.key] || new Array(filterStages.length).fill(false);
    const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
    const isBlocked = stageCompletion.blocked || false;
    return getHealthStatus(completionPercent, isBlocked, sprintConfig);
  });

  // Health counts for "At-risk work" metric (all issues)
  const blockedCount = issueHealthStats.filter(h => h.status === 'Blocked').length;
  const behindCount = issueHealthStats.filter(h => h.status === 'Behind').length;
  const atRiskCount = issueHealthStats.filter(h => h.status === 'At Risk').length;
  const onTrackCount = issueHealthStats.filter(h => h.status === 'On Track').length;
  const aheadCount = issueHealthStats.filter(h => h.status === 'Ahead').length;
  const doneCount = issueHealthStats.filter(h => h.status === 'Done').length;

  // Sprint health counts (FEATURE TICKETS ONLY)
  const featureBlockedCount = featureHealthStats.filter(h => h.status === 'Blocked').length;
  const featureBehindCount = featureHealthStats.filter(h => h.status === 'Behind').length;
  const featureAtRiskCount = featureHealthStats.filter(h => h.status === 'At Risk').length;
  const featureOnTrackCount = featureHealthStats.filter(h => h.status === 'On Track').length;
  const featureAheadCount = featureHealthStats.filter(h => h.status === 'Ahead').length;
  const featureDoneCount = featureHealthStats.filter(h => h.status === 'Done').length;

  // Determine overall sprint health based on FEATURE tickets only
  let sprintHealth;
  const totalFeatureIssues = featureIssues.length;
  if (totalFeatureIssues === 0) {
    sprintHealth = { status: 'No Data', color: '#9ca3af', icon: '○' };
  } else if (featureBlockedCount > 0 || featureBehindCount > totalFeatureIssues * 0.3) {
    sprintHealth = { status: 'Critical', color: '#dc2626', icon: '⚠️' };
  } else if (featureAtRiskCount + featureBehindCount > totalFeatureIssues * 0.2) {
    sprintHealth = { status: 'At Risk', color: '#f59e0b', icon: '⚠' };
  } else if (featureDoneCount === totalFeatureIssues) {
    sprintHealth = { status: 'Complete', color: '#16a34a', icon: '✓' };
  } else if (avgProgress >= 90) {
    sprintHealth = { status: 'Excellent', color: '#16a34a', icon: '🎯' };
  } else if (featureAheadCount + featureOnTrackCount > totalFeatureIssues * 0.7) {
    sprintHealth = { status: 'Healthy', color: '#0891b2', icon: '✓' };
  } else {
    sprintHealth = { status: 'Fair', color: '#0891b2', icon: '→' };
  }

  const riskCount = blockedCount + behindCount + atRiskCount;

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
          newStages[issue.key] = new Array(filterStages.length).fill(false);
        }
      });
      setIssueStages(newStages);

      setShowAddModal(false);
      setLastSync(new Date());
    } catch (error) {
      alert(`Failed to add source: ${error.message}`);
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
            newStages[issue.key] = new Array(filterStages.length).fill(false);
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

          alert(`Sync completed!\n\n${message.join('\n')}\n\nPer-filter changes:\n${filterBreakdown}`);
        } else {
          // Still show per-filter info even if no changes detected
          const filterInfo = updatedFilters.map(f =>
            `  ${f.name}: ${f.issues.length} issues`
          ).join('\n');
          alert(`✅ Sync completed! No changes detected.\n\nCurrent state:\n${filterInfo}`);
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

      alert(errorMessage);
    } finally {
      setLoading(false);
      console.log('🏁 Sync operation completed');
    }
  };

  const toggleStage = (issueKey, stageIndex, filter) => {
    const filterStages = getStagesForFilter(filter);
    const newStages = { ...issueStages };
    if (!newStages[issueKey]) {
      newStages[issueKey] = new Array(filterStages.length).fill(false);
    }

    // Toggle the stage
    newStages[issueKey][stageIndex] = !newStages[issueKey][stageIndex];

    // Auto-complete all previous stages if this stage is marked complete
    if (newStages[issueKey][stageIndex]) {
      for (let i = 0; i < stageIndex; i++) {
        newStages[issueKey][i] = true;
      }
    }
    // Auto-uncomplete all subsequent stages if this stage is unmarked
    else {
      for (let i = stageIndex + 1; i < filterStages.length; i++) {
        newStages[issueKey][i] = false;
      }
    }

    setIssueStages(newStages);
  };

  const toggleBlocked = (issueKey) => {
    const newStages = { ...issueStages };
    if (!newStages[issueKey]) {
      newStages[issueKey] = new Array(stages.length).fill(false);
    }

    // Toggle blocked flag (stored as special property)
    newStages[issueKey].blocked = !newStages[issueKey].blocked;
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
    const sprintKey = getSprintKey(sprintConfig);
    const shareData = {
      config: sprintConfig,
      filters: dynamicFilters,
      stages: issueStages,
      viewDensity,
      timestamp: new Date().toISOString(),
    };

    // Compress and encode the data
    const encoded = btoa(JSON.stringify(shareData));
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert(`✅ Shareable link copied to clipboard!\n\nYour coworkers can paste this link to see:\n• Sprint: ${sprintConfig.name}\n• Filters: ${dynamicFilters.length} filter(s)\n• All progress and stages\n• View density: ${viewDensity}\n\nLink:\n${shareUrl}`);
    }).catch(() => {
      // Fallback: show the link in an alert
      prompt('Copy this shareable link:', shareUrl);
    });
  };

  // PDF Export functionality
  const handleExportPDF = async () => {
    try {
      setLoading(true);

      // Dynamically import libraries to reduce initial bundle size
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Create a temporary container for the PDF content
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.width = '1200px';
      pdfContainer.style.background = '#ffffff';
      pdfContainer.style.padding = '40px';
      document.body.appendChild(pdfContainer);

      // Build the infographic content
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      pdfContainer.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px solid #667eea;">
            <h1 style="font-size: 42px; font-weight: 800; color: #1a202c; margin: 0 0 12px 0;">
              ${sprintConfig.name} - Sprint Report
            </h1>
            <p style="font-size: 18px; color: #64748b; margin: 0;">
              ${formatDate(sprintConfig.startDate)} - ${formatDate(sprintConfig.endDate)}
            </p>
            <p style="font-size: 14px; color: #94a3b8; margin: 8px 0 0 0;">
              Generated on ${date}
            </p>
          </div>

          <!-- Key Metrics -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px;">
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 24px; border-radius: 16px; border-left: 4px solid ${sprintHealth.color};">
              <div style="font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 8px;">SPRINT HEALTH</div>
              <div style="font-size: 36px; font-weight: 800; color: #111827; margin-bottom: 4px;">${sprintHealth.status}</div>
              <div style="font-size: 13px; color: #64748b;">${featureAheadCount + featureOnTrackCount}/${totalFeatureIssues} on track</div>
            </div>

            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 24px; border-radius: 16px; border-left: 4px solid #3b82f6;">
              <div style="font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 8px;">COMPLETION</div>
              <div style="font-size: 36px; font-weight: 800; color: #111827; margin-bottom: 4px;">${avgProgress}%</div>
              <div style="font-size: 13px; color: #64748b;">${Math.round(completedPoints)}/${points} points</div>
            </div>

            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 16px; border-left: 4px solid #f59e0b;">
              <div style="font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 8px;">VELOCITY</div>
              <div style="font-size: 36px; font-weight: 800; color: #111827; margin-bottom: 4px;">${getWeeklyVelocity().velocity} pts</div>
              <div style="font-size: 13px; color: #64748b;">per week</div>
            </div>
          </div>

          <!-- Work Breakdown -->
          <div style="margin-bottom: 40px;">
            <h2 style="font-size: 24px; font-weight: 700; color: #1a202c; margin: 0 0 20px 0;">Work Breakdown</h2>
            ${allFilters.map(filter => {
        const filterIssues = issues.filter(i => i.filter === filter.name);
        const filterPoints = filterIssues.reduce((sum, i) => sum + i.points, 0);
        const filterCompleted = filterIssues.reduce((sum, i) => sum + (i.points * (i.percent / 100)), 0);
        const filterProgress = Math.round((filterCompleted / filterPoints) * 100) || 0;

        return `
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid ${filter.accent};">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                      <div style="font-size: 18px; font-weight: 700; color: #111827;">${filter.name}</div>
                      <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${WORKFLOWS[filter.workflow || 'feature'].name}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 28px; font-weight: 800; color: #111827;">${filterProgress}%</div>
                      <div style="font-size: 13px; color: #64748b;">${Math.round(filterCompleted)}/${filterPoints} pts</div>
                    </div>
                  </div>
                  <div style="background: #e2e8f0; height: 8px; border-radius: 999px; overflow: hidden;">
                    <div style="background: ${filter.accent}; height: 100%; width: ${filterProgress}%; border-radius: 999px;"></div>
                  </div>
                  <div style="font-size: 13px; color: #64748b; margin-top: 8px;">${filterIssues.length} issues</div>
                </div>
              `;
      }).join('')}
          </div>

          <!-- Risk Summary -->
          <div style="background: ${riskCount > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 24px; border-radius: 16px; border-left: 4px solid ${riskCount > 0 ? '#ef4444' : '#10b981'};">
            <h3 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 16px 0;">Risk Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              <div>
                <div style="font-size: 13px; font-weight: 600; color: #64748b;">BLOCKED</div>
                <div style="font-size: 24px; font-weight: 800; color: #ef4444;">${blockedCount}</div>
              </div>
              <div>
                <div style="font-size: 13px; font-weight: 600; color: #64748b;">BEHIND</div>
                <div style="font-size: 24px; font-weight: 800; color: #f59e0b;">${behindCount}</div>
              </div>
              <div>
                <div style="font-size: 13px; font-weight: 600; color: #64748b;">AT RISK</div>
                <div style="font-size: 24px; font-weight: 800; color: #f97316;">${atRiskCount}</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
            Generated by Sprint Tracker • ${date}
          </div>
        </div>
      `;

      // Capture the content as canvas
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Remove temporary container
      document.body.removeChild(pdfContainer);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Save the PDF
      const fileName = `${sprintConfig.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      alert(`✅ PDF report generated successfully!\n\nFile: ${fileName}`);

    } catch (error) {
      console.error('PDF generation error:', error);
      alert(`❌ Failed to generate PDF:\n\n${error.message}\n\nPlease make sure you have an active internet connection.`);
    } finally {
      setLoading(false);
    }
  };

  // Show simplified welcome state when no filters
  const showWelcomeState = dynamicFilters.length === 0;

  return (
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
              <button className="primary-button large" onClick={() => setShowAddModal(true)}>
                <Plus size={20} />
                Add Jira Filter to Get Started
              </button>
              <button className="secondary-button" onClick={() => setShowSprintConfigModal(true)}>
                <Clock3 size={18} />
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
              <span style={{ display: 'block', marginTop: '8px', fontWeight: 700, color: getDaysRemaining() < 3 ? '#dc2626' : '#10b981' }}>
                {getDaysRemaining() > 0 ? `${getDaysRemaining()} days remaining` : getDaysRemaining() === 0 ? 'Last day!' : 'Sprint ended'}
              </span>
            </p>
          </div>

          <div className="hero-actions">
            <button
              className="secondary-button"
              onClick={() => setViewDensity(viewDensity === 'dense' ? 'relaxed' : 'dense')}
              title={viewDensity === 'dense' ? 'Switch to Relaxed View' : 'Switch to Dense View'}
            >
              <SlidersHorizontal size={17} /> {viewDensity === 'dense' ? 'Relaxed' : 'Dense'}
            </button>
            <button className="secondary-button" onClick={() => setShowSprintConfigModal(true)}>
              <Clock3 size={17} /> Configure Sprint
            </button>
            <button className="secondary-button" onClick={() => setShowAddModal(true)} disabled={loading}>
              <Filter size={17} /> Add Jira filter
            </button>
            <button
              className="secondary-button"
              onClick={handleExportPDF}
              disabled={loading || dynamicFilters.length === 0}
              title="Export sprint report as PDF for leadership"
            >
              <Download size={17} /> Export PDF
            </button>
            <button
              className="secondary-button"
              onClick={handleShare}
              disabled={dynamicFilters.length === 0}
              title="Generate shareable link to this exact view"
            >
              <Link2 size={17} /> Share View
            </button>
            <button className="primary-button" onClick={handleSyncAll} disabled={loading || dynamicFilters.length === 0}>
              <RefreshCcw size={17} /> {loading ? 'Syncing...' : 'Sync Jira'}
            </button>
          </div>
        </section>
      )}

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
              label="Sprint Health"
              value={sprintHealth.status}
              detail={`${featureAheadCount + featureOnTrackCount}/${totalFeatureIssues} features on track · ${featureBlockedCount} blocked`}
              icon={<span style={{ fontSize: '1.5rem' }}>{sprintHealth.icon}</span>}
              customColor={sprintHealth.color}
            />
            <Metric label="Issues in scope" value={issues.length} detail={`${points} total story points`} icon={<Link2 size={18} />} />
            <Metric
              label="Completion"
              value={`${avgProgress}%`}
              detail={`${Math.round(completedPoints)}/${points} weighted story points`}
              icon={<CheckCircle2 size={18} />}
            />
            <VelocityMetric velocity={getWeeklyVelocity()} totalPoints={points} completedPoints={completedPoints} />
            <Metric
              label="At-risk work"
              value={riskCount}
              detail={`${atRiskCount} at risk · ${behindCount} behind · ${blockedCount} blocked (all workflows)`}
              icon={<AlertTriangle size={18} />}
              warning={riskCount > 0}
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
                    <input placeholder="Search filters, owners, keys" />
                  </label>

                  <div className="filter-list">
                    {allFilters.length === 0 ? (
                      <div className="empty-state">
                        <Filter size={48} strokeWidth={1.5} />
                        <h3>No filters added yet</h3>
                        <p>Click "Add Jira filter" above to get started</p>
                        <small>You'll need a filter ID from Jira</small>
                      </div>
                    ) : (
                      allFilters.map((filter) => (
                        <article className="filter-card" key={filter.id} style={{ '--accent': filter.accent }}>
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
                              ? `${filter.jql.substring(0, 80)}...`
                              : filter.jql}
                          </p>
                          <div className="filter-stats">
                            <span>{filter.issues.length} issues</span>
                            <span>{filter.issues.reduce((sum, issue) => sum + issue.points, 0)} pts</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
            </aside>

            <section className="planner-panel">
              <div className="panel-heading planner-heading">
                <div>
                  <p className="eyebrow">Roadmap matrix</p>
                  <h2>Sprint status by delivery stage</h2>
                  {allFilters.length > 0 && (
                    <small style={{ color: '#64748b', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                      💡 Click on any stage to mark it complete or incomplete
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
                ) : (
                  <>
                    {allFilters.map((filter) => {
                      const filterStages = getStagesForFilter(filter);

                      return (
                        <div className="filter-section" key={filter.id}>
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
                              stageCompletion={issueStages[issue.key] || new Array(filterStages.length).fill(false)}
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

    </main>
  );
};

function Metric({ label, value, detail, icon, warning = false, customColor = null }) {
  return (
    <article
      className={`metric-card ${warning ? 'warning' : ''}`}
      style={customColor ? {
        borderLeft: `4px solid ${customColor}`,
        background: `linear-gradient(135deg, ${customColor}08 0%, transparent 100%)`
      } : {}}
    >
      {icon && <div className="metric-icon">{icon}</div>}
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function VelocityMetric({ velocity, totalPoints, completedPoints }) {
  const [showExplanation, setShowExplanation] = React.useState(false);

  const remainingPoints = totalPoints - completedPoints;
  const projectedTotal = velocity.velocity * velocity.totalWeeks;
  const percentOnTrack = totalPoints > 0 ? Math.min(100, Math.round((projectedTotal / totalPoints) * 100)) : 0;

  return (
    <article
      className="metric-card velocity-card"
      style={{
        borderLeft: `4px solid ${velocity.onTrack ? '#10b981' : '#f59e0b'}`,
        background: `linear-gradient(135deg, ${velocity.onTrack ? '#10b981' : '#f59e0b'}08 0%, transparent 100%)`,
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="metric-icon"><TrendingUp size={18} /></div>
            <p className="metric-label">Weekly Velocity</p>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '700',
                color: '#6b7280',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.background = 'none'}
              title="Click to learn how velocity is calculated"
            >
              ?
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
            <strong className="metric-value">{velocity.velocity} pts</strong>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: '600' }}>/ week</span>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: '600' }}>
                Week {velocity.weeksElapsed} of {velocity.totalWeeks}
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: '700',
                color: velocity.onTrack ? '#10b981' : '#f59e0b'
              }}>
                {velocity.onTrack ? '✓ On track' : `⚠ ${velocity.weeksNeeded} weeks needed`}
              </span>
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{
                height: '6px',
                background: '#e5e7eb',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, percentOnTrack)}%`,
                  background: velocity.onTrack ?
                    'linear-gradient(90deg, #10b981 0%, #059669 100%)' :
                    'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: '600' }}>
                  {Math.round(completedPoints)} pts done
                </span>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: '600' }}>
                  {Math.round(projectedTotal)} pts projected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExplanation && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(2px)',
              zIndex: 9998,
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={() => setShowExplanation(false)}
          />

          {/* Popover */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            maxWidth: '500px',
            width: '90%',
            padding: '20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
            fontSize: '0.85rem',
            color: '#374151',
            lineHeight: '1.6',
            animation: 'slideIn 0.2s ease'
          }}>
            <button
              onClick={() => setShowExplanation(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '1.2rem',
                color: '#9ca3af',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = '#374151'}
              onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
            >
              ×
            </button>

            <div style={{ fontWeight: '700', marginBottom: '12px', color: '#111827', fontSize: '1rem' }}>
              📊 How Velocity is Calculated
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Velocity</strong> = Completed Points ÷ Weeks Elapsed
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Current:</strong> {Math.round(completedPoints)} pts ÷ {velocity.weeksElapsed} weeks = <strong>{velocity.velocity} pts/week</strong>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Projection:</strong> {velocity.velocity} pts/week × {velocity.totalWeeks} weeks = <strong>{Math.round(projectedTotal)} pts</strong>
            </div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
              {velocity.onTrack ? (
                <span style={{ color: '#10b981' }}>
                  ✓ At current pace, you'll complete {Math.round(projectedTotal)} of {totalPoints} pts ({percentOnTrack}%)
                </span>
              ) : (
                <span style={{ color: '#f59e0b' }}>
                  ⚠ At current pace, you'll complete {Math.round(projectedTotal)} of {totalPoints} pts ({percentOnTrack}%). Need {velocity.weeksNeeded} weeks to finish all work.
                </span>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </article>
  );
}

function IssueRow({ issue, filter, stageCompletion, onToggleStage, onToggleBlocked, sprintConfig }) {
  const filterStages = getStagesForFilter(filter);
  const weights = getWeightsForFilter(filter);
  const completedCount = stageCompletion.filter(Boolean).length;
  const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
  const isBlocked = stageCompletion.blocked || false;
  const health = getHealthStatus(completionPercent, isBlocked, sprintConfig);

  return (
    <div className="matrix-grid issue-row" style={{ '--stage-count': filterStages.length, '--accent': filter.accent }}>
      <div className="sticky-cell issue-cell">
        <div className="issue-cell-header">
          <a
            href={`https://tekion.atlassian.net/browse/${issue.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="issue-key-link"
            title="Open in Jira"
          >
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
        <a
          href={`https://tekion.atlassian.net/browse/${issue.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="view-in-jira-link"
        >
          View in Jira →
        </a>
        <div className="mini-progress-bar">
          <div className="mini-progress-fill" style={{ width: `${completionPercent}%` }}></div>
        </div>
      </div>

      {filterStages.map((stage, index) => {
        const isCompleted = stageCompletion[index];
        const completedCount = stageCompletion.filter(Boolean).length;
        const isCurrent = !isCompleted && (index === 0 || stageCompletion[index - 1]);

        // Calculate cumulative percentage range for tooltip only
        const percentPerStage = Math.round(100 / filterStages.length);
        const stageStartPercent = (index * percentPerStage);
        const stageEndPercent = ((index + 1) * percentPerStage);
        const percentageRange = `${stageStartPercent}% - ${stageEndPercent}%`;

        return (
          <div
            className={`stage-cell ${isCompleted ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} clickable-stage`}
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
          style={{
            color: health.color,
            borderColor: health.borderColor,
            backgroundColor: health.bgColor
          }}
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

// Sprint gate presets based on GM release calendar
const SPRINT_GATES = {
  'June-26': {
    name: 'June 2026 Release',
    developmentStart: '2026-04-23',
    developmentEnd: '2026-05-21',
    releaseDate: '2026-06-10',
  },
  'July-26': {
    name: 'July 2026 Release',
    developmentStart: '2026-05-28',
    developmentEnd: '2026-06-25',
    releaseDate: '2026-07-15',
  },
  'Aug-26': {
    name: 'August 2026 Release',
    developmentStart: '2026-06-25',
    developmentEnd: '2026-07-23',
    releaseDate: '2026-08-12',
  },
  'Sep-26': {
    name: 'September 2026 Release',
    developmentStart: '2026-07-23',
    developmentEnd: '2026-08-20',
    releaseDate: '2026-09-09',
  },
  'Oct-26': {
    name: 'October 2026 Release',
    developmentStart: '2026-08-20',
    developmentEnd: '2026-09-17',
    releaseDate: '2026-10-07',
  },
};

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

createRoot(document.getElementById('root')).render(<App />);
