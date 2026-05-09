import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp } from 'lucide-react';

export function VelocityMetric({ velocity, totalPoints, completedPoints }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const projectedTotal = velocity.velocity * velocity.totalWeeks;
  const percentOnTrack = totalPoints > 0 ? Math.min(100, Math.round((projectedTotal / totalPoints) * 100)) : 0;

  return (
    <article
      className="metric-card velocity-card"
      style={{
        borderLeft: `4px solid ${velocity.onTrack ? '#10b981' : '#f59e0b'}`,
        background: `linear-gradient(135deg, ${velocity.onTrack ? '#10b981' : '#f59e0b'}08 0%, transparent 100%)`,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="metric-icon"><TrendingUp size={18} /></div>
            <p className="metric-label">Weekly Velocity</p>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '700',
                color: '#6b7280',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(event) => event.target.style.background = '#f3f4f6'}
              onMouseLeave={(event) => event.target.style.background = 'none'}
              title="Click to learn how velocity is calculated"
            >
              ?
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
            <strong className="metric-value">{velocity.velocity} pts</strong>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: '600' }}>/ week</span>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: '600' }}>
                Week {velocity.weeksElapsed} of {velocity.totalWeeks}
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: '700',
                color: velocity.onTrack ? '#10b981' : '#f59e0b',
              }}>
                {velocity.onTrack ? '✓ On track' : `⚠ ${velocity.weeksNeeded} weeks needed`}
              </span>
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{
                height: '6px',
                background: '#e5e7eb',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, percentOnTrack)}%`,
                  background: velocity.onTrack
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: '600' }}>
                  {Math.round(completedPoints)} pts done
                </span>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: '600' }}>
                  {Math.round(projectedTotal)} pts projected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExplanation && createPortal(
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(2px)',
              zIndex: 9998,
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={() => setShowExplanation(false)}
          />

          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            maxWidth: '500px',
            width: '90%',
            padding: '20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
            fontSize: '0.85rem',
            color: '#374151',
            lineHeight: '1.6',
            animation: 'slideIn 0.2s ease',
          }}>
            <button
              onClick={() => setShowExplanation(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '1.2rem',
                color: '#9ca3af',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(event) => event.target.style.color = '#374151'}
              onMouseLeave={(event) => event.target.style.color = '#9ca3af'}
            >
              ×
            </button>

            <div style={{ fontWeight: '700', marginBottom: '12px', color: '#111827', fontSize: '1rem' }}>
              📊 How Velocity is Calculated
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Velocity</strong> = Completed Points ÷ Weeks Elapsed
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Current:</strong> {Math.round(completedPoints)} pts ÷ {velocity.weeksElapsed} weeks = <strong>{velocity.velocity} pts/week</strong>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Projection:</strong> {velocity.velocity} pts/week × {velocity.totalWeeks} weeks = <strong>{Math.round(projectedTotal)} pts</strong>
            </div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
              {velocity.onTrack ? (
                <span style={{ color: '#10b981' }}>
                  ✓ At current pace, you'll complete {Math.round(projectedTotal)} of {totalPoints} pts ({percentOnTrack}%)
                </span>
              ) : (
                <span style={{ color: '#f59e0b' }}>
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
