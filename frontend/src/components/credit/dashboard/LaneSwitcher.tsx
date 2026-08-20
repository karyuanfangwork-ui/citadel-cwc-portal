import React from 'react';
import { LANE_LABELS, type CreditLane } from './useCreditLane';

interface LaneSwitcherProps {
  lane: CreditLane;
  lanes: CreditLane[];
  onChange: (lane: CreditLane) => void;
}

const LaneSwitcher: React.FC<LaneSwitcherProps> = ({ lane, lanes, onChange }) => {
  if (lanes.length < 2) return null;
  return (
    <div role="tablist" aria-label="Credit view" style={{ display: 'flex', gap: 4, background: 'var(--cr-surface-container-low)', padding: 3, borderRadius: 'var(--cr-radius)' }}>
      {lanes.map(currentLane => (
        <button
          key={currentLane}
          type="button"
          role="tab"
          aria-selected={currentLane === lane}
          onClick={() => onChange(currentLane)}
          style={{
            fontFamily: 'var(--cr-font-display)', fontSize: 13, fontWeight: 600,
            padding: '6px 14px', border: 'none', cursor: 'pointer',
            borderRadius: 'var(--cr-radius)',
            background: currentLane === lane ? 'var(--cr-surface-container-lowest)' : 'transparent',
            color: currentLane === lane ? 'var(--cr-on-surface)' : 'var(--cr-on-surface-variant)',
          }}
        >
          {LANE_LABELS[currentLane]}
        </button>
      ))}
    </div>
  );
};

export default LaneSwitcher;
