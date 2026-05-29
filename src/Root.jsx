import React, { useState, useEffect } from 'react';
import { PROXY_ROOT } from './config.js';
import { LoadingScreen } from './components/atoms/LoadingScreen.jsx';
import LoginForm from './components/organisms/LoginForm.jsx';
import { App } from './App.jsx';

export function Root() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    fetch(`${PROXY_ROOT}/api/auth/me`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(user => { setAuthUser(user); setAuthReady(true); })
      .catch(() => setAuthReady(true));
  }, []);

  if (!authReady) return <LoadingScreen />;
  if (!authUser) return <LoginForm onLogin={(user) => setAuthUser(user)} />;

  return <App authUser={authUser} onLogout={async () => {
    await fetch(`${PROXY_ROOT}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthUser(null);
  }} />;
}
