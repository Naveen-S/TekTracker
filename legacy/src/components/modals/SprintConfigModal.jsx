import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SPRINT_GATES } from '../../workflows.js';

export function SprintConfigModal({ config, onSave, onClose }) {
  const [configMode, setConfigMode] = useState('gates');
  const [selectedGate, setSelectedGate] = useState('');
  const [sprintName, setSprintName] = useState(config.name);
  const [startDate, setStartDate] = useState(config.startDate);
  const [endDate, setEndDate] = useState(config.endDate);
  const [releaseDate, setReleaseDate] = useState(config.releaseDate || '');
  const [error, setError] = useState('');

  const handleGateSelect = (gateKey) => {
    setSelectedGate(gateKey);
    const gate = SPRINT_GATES[gateKey];
    setSprintName(gate.name);
    setStartDate(gate.developmentStart);
    setEndDate(gate.developmentEnd);
    setReleaseDate(gate.releaseDate);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!sprintName.trim()) {
      setError('Please enter a sprint name');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    setError('');
    onSave({ name: sprintName.trim(), startDate, endDate, releaseDate });
  };

  const autoFilledBadge = configMode === 'gates' && selectedGate
    ? <span className="autofill-badge">✓ Auto-filled</span>
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Sprint</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Configuration Mode</label>
            <div className="radio-group">
              <label className="radio-label radio-label-lg">
                <input type="radio" name="configMode" value="gates" checked={configMode === 'gates'} onChange={(e) => setConfigMode(e.target.value)} />
                <span>
                  <strong className="radio-option-title">Release Gates</strong>
                  <small className="radio-option-desc">Auto-configure from GM calendar</small>
                </span>
              </label>
              <label className="radio-label radio-label-lg">
                <input type="radio" name="configMode" value="manual" checked={configMode === 'manual'} onChange={(e) => setConfigMode(e.target.value)} />
                <span>
                  <strong className="radio-option-title">Manual Dates</strong>
                  <small className="radio-option-desc">Set custom dates</small>
                </span>
              </label>
            </div>
          </div>

          {configMode === 'gates' && (
            <div className="form-group form-group--mt">
              <label htmlFor="gateSelect">Select Release Month</label>
              <select id="gateSelect" value={selectedGate} onChange={(e) => handleGateSelect(e.target.value)} className="gate-select" autoFocus>
                <option value="">Choose a release month...</option>
                {Object.keys(SPRINT_GATES).map((key) => {
                  const gate = SPRINT_GATES[key];
                  const startFormatted = new Date(gate.developmentStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const endFormatted = new Date(gate.developmentEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <option key={key} value={key}>
                      {gate.name} • Dev: {startFormatted} - {endFormatted}
                    </option>
                  );
                })}
              </select>
              <small>✨ Dates auto-fill from GM release calendar</small>
            </div>
          )}

          <div className="form-group form-group--mt-lg">
            <label htmlFor="sprintName">Sprint Name {autoFilledBadge}</label>
            <input id="sprintName" type="text" value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="e.g., June 2026 Release" autoFocus={configMode === 'manual'} disabled={configMode === 'gates' && !selectedGate} />
            <small>Give your sprint a descriptive name</small>
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Development Start Date {autoFilledBadge}</label>
            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={configMode === 'gates'} />
            <small>When development work begins</small>
          </div>

          <div className="form-group">
            <label htmlFor="endDate">Development End Date {autoFilledBadge}</label>
            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={configMode === 'gates'} />
            <small>When code should be complete on preprod</small>
          </div>

          {releaseDate && (
            <div className="form-group">
              <label htmlFor="releaseDate">Release Date {autoFilledBadge}</label>
              <input id="releaseDate" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} disabled={configMode === 'gates'} />
              <small>Production release date</small>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Save Configuration</button>
          </div>
        </form>
      </div>
    </div>
  );
}
