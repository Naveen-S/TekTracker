import { useState } from 'react';
import { fetchFilterIssues, fetchJQLIssues, transformFilter } from '../jiraService.js';
import { getStagesForFilter, stages, WORKFLOWS } from '../workflows.js';

const insertFilterInOrder = (filters, newFilter) => {
  const newPriority = WORKFLOWS[newFilter.workflow || 'feature'].priority;
  const insertIndex = filters.findIndex(f =>
    WORKFLOWS[f.workflow || 'feature'].priority > newPriority
  );
  if (insertIndex === -1) return [...filters, newFilter];
  const result = [...filters];
  result.splice(insertIndex, 0, newFilter);
  return result;
};

export function useSprintData({ dynamicFilters, setDynamicFilters, issueStages, setIssueStages, setLastSync, showAlert }) {
  const [loading, setLoading] = useState(false);

  const handleAddFilter = async (source) => {
    setLoading(true);
    try {
      let filter, issues;

      if (source.type === 'filter') {
        const result = await fetchFilterIssues(source.filterId);
        filter = result.filter;
        issues = result.issues;
      } else if (source.type === 'jql') {
        const result = await fetchJQLIssues(source.jql, source.name);
        filter = result.filter;
        issues = result.issues;
      }

      const transformedFilter = transformFilter(filter, issues);
      transformedFilter.workflow = source.workflow || 'feature';
      setDynamicFilters(insertFilterInOrder(dynamicFilters, transformedFilter));

      const newStages = { ...issueStages };
      const filterStages = getStagesForFilter(transformedFilter);
      transformedFilter.issues.forEach(issue => {
        if (!newStages[issue.key]) {
          newStages[issue.key] = { stages: new Array(filterStages.length).fill(false), blocked: false };
        }
      });
      setIssueStages(newStages);
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
      const newStages = { ...issueStages };
      filterToRemove.issues.forEach(issue => { delete newStages[issue.key]; });
      setIssueStages(newStages);
    }
    setDynamicFilters(dynamicFilters.filter(f => f.id !== filterId));
  };

  const handleSyncAll = async () => {
    setLoading(true);
    try {
      const updatedFilters = await Promise.all(
        dynamicFilters.map(async (filter) => {
          let filterData, issues;

          if (filter.jql) {
            const result = await fetchJQLIssues(filter.jql, filter.name);
            filterData = result.filter;
            issues = result.issues;
          } else {
            const result = await fetchFilterIssues(filter.id);
            filterData = result.filter;
            issues = result.issues;
          }

          const transformed = transformFilter(filterData, issues);
          transformed.workflow = filter.workflow || 'feature';

          if (filterData.jql) {
            transformed.jql = filterData.jql;
          } else if (filter.jql) {
            transformed.jql = filter.jql;
          }

          return transformed;
        })
      );

      const oldIssueKeys = new Set(dynamicFilters.flatMap(f => f.issues.map(i => i.key)));
      const newIssueKeys = new Set(updatedFilters.flatMap(f => f.issues.map(i => i.key)));
      const addedIssues = [...newIssueKeys].filter(key => !oldIssueKeys.has(key));
      const removedIssues = [...oldIssueKeys].filter(key => !newIssueKeys.has(key));

      const newStages = { ...issueStages };
      updatedFilters.forEach(filter => {
        const filterStages = getStagesForFilter(filter);
        filter.issues.forEach(issue => {
          if (!newStages[issue.key]) {
            newStages[issue.key] = { stages: new Array(filterStages.length).fill(false), blocked: false };
          }
        });
      });
      removedIssues.forEach(key => { delete newStages[key]; });

      setIssueStages(newStages);
      setDynamicFilters(updatedFilters);
      setLastSync(new Date());

      setTimeout(() => {
        if (addedIssues.length > 0 || removedIssues.length > 0) {
          const message = [];
          if (addedIssues.length > 0) {
            message.push(`✅ ${addedIssues.length} new issue(s): ${addedIssues.slice(0, 3).join(', ')}${addedIssues.length > 3 ? '...' : ''}`);
          }
          if (removedIssues.length > 0) {
            message.push(`🗑️ ${removedIssues.length} removed issue(s): ${removedIssues.slice(0, 3).join(', ')}${removedIssues.length > 3 ? '...' : ''}`);
          }
          const filterBreakdown = updatedFilters.map((filter) => {
            const oldFilter = dynamicFilters.find(f => filter.jql ? (f.jql === filter.jql) : (f.id === filter.id));
            const oldCount = oldFilter ? oldFilter.issues.length : 0;
            const newCount = filter.issues.length;
            const change = newCount - oldCount;
            return `  ${filter.name}: ${oldCount} → ${newCount} (${change >= 0 ? '+' : ''}${change})`;
          }).join('\n');
          showAlert('Sync Completed', `${message.join('\n')}\n\nPer-filter changes:\n${filterBreakdown}`, 'success');
        } else {
          const filterInfo = updatedFilters.map(f => `  ${f.name}: ${f.issues.length} issues`).join('\n');
          showAlert('Sync Completed', `No changes detected.\n\nCurrent state:\n${filterInfo}`, 'success');
        }
      }, 100);

    } catch (error) {
      let errorMessage = `Failed to sync filters:\n\n${error.message}`;
      if (error.message.includes('proxy server')) {
        errorMessage += '\n\n💡 Make sure the proxy server is running:\nRun: npm run proxy\nin a separate terminal';
      } else if (error.message.includes('CORS')) {
        errorMessage += '\n\n💡 CORS issue detected. The proxy server should handle this.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage += '\n\n💡 Filter not found. Check that the filter ID or JQL is correct.';
      }
      showAlert('Sync Failed', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleStage = (issueKey, stageIndex, filter) => {
    const filterStages = getStagesForFilter(filter);
    const newStages = { ...issueStages };
    const current = newStages[issueKey] ?? { stages: new Array(filterStages.length).fill(false), blocked: false };
    const stagesArr = [...current.stages];

    stagesArr[stageIndex] = !stagesArr[stageIndex];

    if (stagesArr[stageIndex]) {
      for (let i = 0; i < stageIndex; i++) stagesArr[i] = true;
    } else {
      for (let i = stageIndex + 1; i < filterStages.length; i++) stagesArr[i] = false;
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

  return { loading, setLoading, handleAddFilter, handleRemoveFilter, handleSyncAll, toggleStage, toggleBlocked };
}
