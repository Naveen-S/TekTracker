import React from 'react';
import { RefreshCcw, Plus, Search } from 'lucide-react';

export function TopBar({ onAddFilter, onSync, syncing, userInitials = 'RG' }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src="/tekion-logo.svg" alt="Tekion" className="topbar-logo" />
        <span className="topbar-divider" aria-hidden="true" />
        <div className="topbar-product">
          <span className="topbar-product-name">Sprint Tracker</span>
          <span className="topbar-product-tag">Engineering · Internal</span>
        </div>
      </div>

      <nav className="topbar-nav" aria-label="Primary navigation">
        <a className="topbar-nav-item is-active" href="#">Dashboard</a>
        <a className="topbar-nav-item" href="#">Filters</a>
        <a className="topbar-nav-item" href="#">Velocity</a>
        <a className="topbar-nav-item" href="#">Settings</a>
      </nav>

      <div className="topbar-right">
        <button className="topbar-icon-btn" aria-label="Search">
          <Search size={18} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onAddFilter}>
          <Plus size={16} /> Add filter
        </button>
        <button
          className={'btn btn-primary btn-sm' + (syncing ? ' is-loading' : '')}
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCcw size={16} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Jira'}
        </button>
        <div className="topbar-avatar" title={userInitials}>{userInitials}</div>
      </div>
    </header>
  );
}
