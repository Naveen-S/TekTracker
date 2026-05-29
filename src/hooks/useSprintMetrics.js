import { useState, useMemo } from 'react';
import { WORKFLOWS } from '../workflows.js';
import { computeSprintMetrics } from '../utils/sprintMetricsCompute.js';

export function useSprintMetrics({ dynamicFilters, issueStages, sprintConfig }) {
  const [searchQuery, setSearchQuery] = useState('');

  const allFilters = useMemo(() => [...dynamicFilters], [dynamicFilters]);

  const issueFilterMap = useMemo(() => {
    const map = new Map();
    allFilters.forEach((filter) => {
      filter.issues?.forEach((issue) => {
        map.set(issue.key, filter);
      });
    });
    return map;
  }, [allFilters]);

  const sprintMetrics = useMemo(
    () => computeSprintMetrics(allFilters, issueStages, sprintConfig),
    [allFilters, issueStages, sprintConfig]
  );

  const visibleFilters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allFilters;

    return allFilters.reduce((matches, filter) => {
      const filterMatches = [filter.name, filter.jql, WORKFLOWS[filter.workflow || 'feature'].name]
        .some(value => String(value || '').toLowerCase().includes(query));

      const matchingIssues = filter.issues.filter(issue =>
        [issue.key, issue.title, issue.owner, issue.type, issue.jiraStatus]
          .some(value => String(value || '').toLowerCase().includes(query))
      );

      if (filterMatches) {
        matches.push(filter);
      } else if (matchingIssues.length > 0) {
        matches.push({ ...filter, issues: matchingIssues });
      }
      return matches;
    }, []);
  }, [allFilters, searchQuery]);

  return { allFilters, issueFilterMap, sprintMetrics, visibleFilters, searchQuery, setSearchQuery };
}
