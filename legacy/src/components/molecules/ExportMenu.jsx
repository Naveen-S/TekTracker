import React from 'react';
import { Download } from 'lucide-react';

export function ExportMenu({ loading, hasFilters, onToggleMenu }) {
  return (
    <div className="export-menu">
      <button
        className="btn btn-on-dark btn-sm"
        onClick={onToggleMenu}
        disabled={loading || !hasFilters}
      >
        <Download size={16} /> Export
      </button>
    </div>
  );
}
