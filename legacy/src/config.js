export const PROXY_ROOT = (import.meta.env.VITE_JIRA_API_BASE_URL || 'http://localhost:3001/api/jira')
  .replace(/\/api\/jira\/?$/, '');
