import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      'import.meta.env.VITE_JIRA_BASE_URL': JSON.stringify(env.VITE_JIRA_BASE_URL || env.JIRA_BASE_URL || ''),
      'import.meta.env.VITE_JIRA_API_BASE_URL': JSON.stringify(env.VITE_JIRA_API_BASE_URL || 'http://localhost:3001/api/jira'),
      'import.meta.env.VITE_USE_JIRA_PROXY': JSON.stringify(env.VITE_USE_JIRA_PROXY || 'true'),
    },
  };
});
