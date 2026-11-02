/**
 * Scope controls: channel toggles, volts/div, time/div knobs
 */

import React, { useState } from 'react';
import type { SimResult } from '@/shared/types';
import type { ScopeViewState } from './scope-renderer';

const ONE_TWO_FIVE = [
  0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
];

interface ScopeControlsProps {
  viewState: ScopeViewState;
  simResult: SimResult | null;
  locale: Record<string, string>;
  onViewStateChange: (newState: ScopeViewState) => void;
}

export function ScopeControls({
  viewState,
  simResult,
  locale,
  onViewStateChange,
}: ScopeControlsProps) {
  const [focusedKnob, setFocusedKnob] = useState<'volts' | 'time' | null>(null);

  const handleVoltsChange = (direction: 1 | -1) => {
    const currentIdx = ONE_TWO_FIVE.indexOf(viewState.voltsPerDiv);
    const newIdx = Math.max(0, Math.min(ONE_TWO_FIVE.length - 1, currentIdx + direction));
    onViewStateChange({
      ...viewState,
      voltsPerDiv: ONE_TWO_FIVE[newIdx],
    });
  };

  const handleTimeChange = (direction: 1 | -1) => {
    const currentIdx = ONE_TWO_FIVE.indexOf(viewState.timePerDiv);
    const newIdx = Math.max(0, Math.min(ONE_TWO_FIVE.length - 1, currentIdx + direction));
    onViewStateChange({
      ...viewState,
      timePerDiv: ONE_TWO_FIVE[newIdx],
    });
  };

  const handleChannelToggle = (idx: number) => {
    const newChannels = [...viewState.channels];
    newChannels[idx] = { ...newChannels[idx], enabled: !newChannels[idx].enabled };
    onViewStateChange({
      ...viewState,
      channels: newChannels,
    });
  };

  const handleChannelVariableChange = (idx: number, varIdx: number) => {
    const newChannels = [...viewState.channels];
    newChannels[idx] = { ...newChannels[idx], variableIndex: varIdx };
    onViewStateChange({
      ...viewState,
      channels: newChannels,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, knob: 'volts' | 'time') => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (knob === 'volts') handleVoltsChange(1);
      else handleTimeChange(1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (knob === 'volts') handleVoltsChange(-1);
      else handleTimeChange(-1);
    }
  };

  const variableNames = simResult?.variableNames ?? ['time', 'V(1)', 'V(2)', 'V(3)'];

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>{locale['scope.voltPerDiv'] || 'Volts/div'}</h3>
        <div style={styles.knobRow}>
          <button
            onClick={() => handleVoltsChange(-1)}
            aria-label="Decrease volts per division"
            style={styles.knobButton}
          >
            −
          </button>
          <input
            type="text"
            readOnly
            value={viewState.voltsPerDiv.toFixed(3)}
            onKeyDown={(e) => handleKeyDown(e, 'volts')}
            onFocus={() => setFocusedKnob('volts')}
            onBlur={() => setFocusedKnob(null)}
            style={{
              ...styles.knobValue,
              ...(focusedKnob === 'volts' && styles.knobValueFocused),
            }}
            aria-label="Volts per division (use arrow keys)"
          />
          <button
            onClick={() => handleVoltsChange(1)}
            aria-label="Increase volts per division"
            style={styles.knobButton}
          >
            +
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>{locale['scope.timePerDiv'] || 'Time/div'}</h3>
        <div style={styles.knobRow}>
          <button
            onClick={() => handleTimeChange(-1)}
            aria-label="Decrease time per division"
            style={styles.knobButton}
          >
            −
          </button>
          <input
            type="text"
            readOnly
            value={viewState.timePerDiv.toFixed(3)}
            onKeyDown={(e) => handleKeyDown(e, 'time')}
            onFocus={() => setFocusedKnob('time')}
            onBlur={() => setFocusedKnob(null)}
            style={{
              ...styles.knobValue,
              ...(focusedKnob === 'time' && styles.knobValueFocused),
            }}
            aria-label="Time per division (use arrow keys)"
          />
          <button
            onClick={() => handleTimeChange(1)}
            aria-label="Increase time per division"
            style={styles.knobButton}
          >
            +
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>{locale['scope.channel'] || 'Channels'}</h3>
        <div style={styles.channelList}>
          {viewState.channels.map((ch, idx) => (
            <div key={idx} style={styles.channelRow}>
              <label style={styles.channelLabel}>
                <input
                  type="checkbox"
                  checked={ch.enabled}
                  onChange={() => handleChannelToggle(idx)}
                  aria-label={`Enable channel ${idx + 1}`}
                  style={styles.channelCheckbox}
                />
                <span
                  style={{
                    ...styles.channelSwatch,
                    backgroundColor: ch.color,
                  }}
                />
                CH{idx + 1}
              </label>
              {ch.enabled && (
                <select
                  value={ch.variableIndex}
                  onChange={(e) => handleChannelVariableChange(idx, parseInt(e.target.value))}
                  aria-label={`Select variable for channel ${idx + 1}`}
                  style={styles.variableSelect}
                >
                  {variableNames.map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    fontSize: '12px',
    fontFamily: '"Share Tech Mono", monospace',
    color: '#39ff14',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#39ff14',
  },
  knobRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  knobButton: {
    minWidth: '44px',
    minHeight: '44px',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: '1px solid #39ff14',
    color: '#39ff14',
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 200ms',
  },
  knobValue: {
    flex: 1,
    padding: '6px 8px',
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
    border: '1px solid #39ff14',
    color: '#39ff14',
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '12px',
    textAlign: 'center',
    outline: 'none',
  },
  knobValueFocused: {
    outlineWidth: '2px',
    outlineStyle: 'solid',
    outlineColor: '#39ff14',
    outlineOffset: '1px',
    boxShadow: '0 0 8px rgba(57, 255, 20, 0.3)',
  },
  channelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  channelRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  channelLabel: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    cursor: 'pointer',
    minHeight: '44px',
    minWidth: '44px',
  },
  channelCheckbox: {
    cursor: 'pointer',
    accentColor: '#39ff14',
  },
  channelSwatch: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    border: '1px solid #39ff14',
  },
  variableSelect: {
    flex: 1,
    padding: '4px 6px',
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
    border: '1px solid #39ff14',
    color: '#39ff14',
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '11px',
    cursor: 'pointer',
  },
};
