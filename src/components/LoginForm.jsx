import React, { useState } from 'react';

const PROXY_ROOT = (import.meta.env.VITE_JIRA_API_BASE_URL || 'http://localhost:3001/api/jira')
  .replace(/\/api\/jira\/?$/, '');

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${PROXY_ROOT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Could not connect to the server. Is it running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/tekion-logo.svg" alt="Tekion" className="topbar-logo" style={{ height: 28, marginBottom: 16 }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--fg-1)' }}>Sprint Tracker</h1>
          <p style={{ color: 'var(--fg-3)', margin: 0, fontSize: '0.9rem' }}>Connect your Jira account to get started</p>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
          <div className="form-group">
            <label htmlFor="login-email">Jira Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@tekion.com"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-token" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>API Token</span>
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--brand-teal)', textDecoration: 'none' }}
              >
                Create token ↗
              </a>
            </label>
            <input
              id="login-token"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste your Jira API token"
              required
              disabled={loading}
            />
            <small>Find this at id.atlassian.com → Security → API tokens</small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          >
            {loading ? 'Connecting…' : 'Connect to Jira'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: '0.75rem', marginTop: 24, marginBottom: 0 }}>
          Engineering · Internal Tool · Tekion Corp
        </p>
      </div>
    </div>
  );
}
