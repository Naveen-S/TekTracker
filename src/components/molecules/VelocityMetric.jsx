import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp } from 'lucide-react';

export function VelocityMetric({ velocity, totalPoints, completedPoints }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const projectedTotal = velocity.velocity * velocity.totalWeeks;
  const percentOnTrack = totalPoints > 0 ? Math.min(100, Math.round((projectedTotal / totalPoints) * 100)) : 0;
  const onTrack = velocity.onTrack;

  return (
    <article className="metric-card velocity-card" data-on-track={String(onTrack)}>
      <div className="velocity-header">
        <div className="velocity-left">
          <div className="velocity-title-row">
            <div className="metric-icon"><TrendingUp size={18} /></div>
            <p className="metric-label">Weekly Velocity</p>
            <button
              className="velocity-explain-btn"
              onClick={() => setShowExplanation(!showExplanation)}
              title="Click to learn how velocity is calculated"
            >
              ?
            </button>
          </div>

          <div className="velocity-value-row">
            <strong className="metric-value">{velocity.velocity} pts</strong>
            <span className="velocity-unit">/ week</span>
          </div>

          <div className="velocity-progress">
            <div className="velocity-week-row">
              <span className="velocity-week-label">Week {velocity.weeksElapsed} of {velocity.totalWeeks}</span>
              <span className={`velocity-status ${onTrack ? 'velocity-status--ok' : 'velocity-status--warn'}`}>
                {onTrack ? '✓ On track' : `⚠ ${velocity.weeksNeeded} weeks needed`}
              </span>
            </div>

            <div className="velocity-bar-wrap">
              <div
                className={`velocity-bar-fill ${onTrack ? 'velocity-bar-fill--ok' : 'velocity-bar-fill--warn'}`}
                style={{ width: `${Math.min(100, percentOnTrack)}%` }}
              />
            </div>
            <div className="velocity-footnotes">
              <span className="velocity-footnote">{Math.round(completedPoints)} pts done</span>
              <span className="velocity-footnote">{Math.round(projectedTotal)} pts projected</span>
            </div>
          </div>
        </div>
      </div>

      {showExplanation && createPortal(
        <>
          <div className="velocity-modal-overlay" onClick={() => setShowExplanation(false)} />
          <div className="velocity-modal">
            <button className="velocity-modal-close" onClick={() => setShowExplanation(false)}>×</button>
            <div className="velocity-modal-title">📊 How Velocity is Calculated</div>
            <div className="velocity-modal-stat">
              <strong>Velocity</strong> = Completed Points ÷ Weeks Elapsed
            </div>
            <div className="velocity-modal-stat">
              <strong>Current:</strong> {Math.round(completedPoints)} pts ÷ {velocity.weeksElapsed} weeks = <strong>{velocity.velocity} pts/week</strong>
            </div>
            <div className="velocity-modal-stat">
              <strong>Projection:</strong> {velocity.velocity} pts/week × {velocity.totalWeeks} weeks = <strong>{Math.round(projectedTotal)} pts</strong>
            </div>
            <div className="velocity-modal-divider">
              {onTrack ? (
                <span className="velocity-modal-result--ok">
                  ✓ At current pace, you'll complete {Math.round(projectedTotal)} of {totalPoints} pts ({percentOnTrack}%)
                </span>
              ) : (
                <span className="velocity-modal-result--warn">
                  ⚠ At current pace, you'll complete {Math.round(projectedTotal)} of {totalPoints} pts ({percentOnTrack}%). Need {velocity.weeksNeeded} weeks to finish all work.
                </span>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </article>
  );
}
