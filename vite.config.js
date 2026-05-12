import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VITE_JIRA_BASE_URL': JSON.stringify(env.VITE_JIRA_BASE_URL || env.JIRA_BASE_URL || ''),
      'import.meta.env.VITE_JIRA_API_BASE_URL': JSON.stringify(env.VITE_JIRA_API_BASE_URL || '/api/jira'),
      'import.meta.env.VITE_USE_JIRA_PROXY': JSON.stringify(env.VITE_USE_JIRA_PROXY || 'true'),
    },
  };
});
