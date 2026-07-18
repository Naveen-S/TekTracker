import React from 'react';
import { X } from 'lucide-react';

export function AppAlertModal({ modal, onClose }) {
  const { title, body, tone = 'info', copyUrl } = modal;

  const handleCopy = () => {
    navigator.clipboard.writeText(copyUrl).then(onClose);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content app-alert-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header" data-tone={tone}>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="app-alert-body">
          {body && <p className="app-alert-text">{body}</p>}
          {copyUrl && (
            <div className="app-alert-copy-row">
              <input
                readOnly
                value={copyUrl}
                className="app-alert-copy-input"
                onFocus={e => e.target.select()}
              />
              <button className="btn btn-primary btn-sm" onClick={handleCopy}>Copy</button>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary btn-sm" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
