import React from 'react';

export function Metric({ label, value, detail, icon, warning = false, customColor = null, tone = null }) {
  const toneClass = tone ? `metric-${tone}` : warning ? 'metric-warn' : '';
  return (
    <article
      className={`metric-card ${toneClass}`}
      style={!tone && customColor ? {
        borderTop: `3px solid ${customColor}`,
      } : {}}
    >
      {icon && <div className="metric-icon">{icon}</div>}
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}
