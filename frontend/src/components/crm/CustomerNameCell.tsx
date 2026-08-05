import React from 'react';

export type Segment = 'RETAIL' | 'SME' | 'CORPORATE';

interface CustomerNameCellProps {
  name: string;
  type: 'account' | 'contact';
  segment: Segment;
}

/* Segment pill styles matching the HTML mockup */
const SEGMENT_PILL: Record<Segment, { bg: string; text: string; border: string }> = {
  RETAIL: {
    bg: '#d3e4fe',     // surface-container-highest
    text: '#45464d',   // on-surface-variant
    border: '#c6c6cd', // outline-variant
  },
  SME: {
    bg: 'rgba(134,242,228,0.3)', // secondary-container/30
    text: '#006f66',   // on-secondary-container
    border: 'rgba(0,106,97,0.2)', // secondary/20
  },
  CORPORATE: {
    bg: '#131b2e',     // primary-container
    text: '#ffffff',
    border: 'transparent',
  },
};

/* Derive initials from name */
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const CustomerNameCell: React.FC<CustomerNameCellProps> = ({ name, type, segment }) => {
  const pill = SEGMENT_PILL[segment];

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      {type === 'contact' ? (
        <div
          className="w-10 h-10 rounded-full border border-[#e2e8f0] overflow-hidden flex items-center justify-center font-bold text-[#45464d] text-sm shrink-0"
          style={{ backgroundColor: '#dce9ff' }}
        >
          {initials(name)}
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{
            backgroundColor: segment === 'CORPORATE' ? 'rgba(19,27,46,0.1)' : 'rgba(134,242,228,0.2)',
            border: `1px solid ${segment === 'CORPORATE' ? '#e2e8f0' : 'rgba(0,106,97,0.3)'}`,
          }}
        >
          <span
            className="material-symbols-outlined text-lg"
            style={{ color: segment === 'CORPORATE' ? '#131b2e' : '#006a61' }}
          >
            {segment === 'CORPORATE' ? 'apartment' : 'business'}
          </span>
        </div>
      )}

      {/* Name + Segment pill */}
      <div className="min-w-0">
        <div className="font-bold text-[#0b1c30] truncate">{name}</div>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-bold border inline-block mt-0.5"
          style={{ backgroundColor: pill.bg, color: pill.text, borderColor: pill.border }}
        >
          {segment}
        </span>
      </div>
    </div>
  );
};

export default CustomerNameCell;