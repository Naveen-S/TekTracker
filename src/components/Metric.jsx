import React from 'react';

export function Metric({ label, value, detail, icon, warning = false, customColor = null }) {
  return (
    <article
      className={`metric-card ${warning ? 'warning' : ''}`}
      style={customColor ? {
        borderLeft: `4px solid ${customColor}`,
        background: `linear-gradient(135deg, ${customColor}08 0%, transparent 100%)`,
      } : {}}
    >
      {icon && <div className="metric-icon">{icon}</div>}
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}
