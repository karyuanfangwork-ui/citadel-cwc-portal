import React, { useRef, useState, useEffect } from 'react';

export type DatePreset = '7d' | '30d' | '90d' | 'quarter';

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: '7d',      label: 'Last 7 Days' },
  { key: '30d',     label: 'Last 30 Days' },
  { key: '90d',     label: 'Last 90 Days' },
  { key: 'quarter', label: 'This Quarter' },
];

interface Props {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

const TEAL = '#006a61';

const DateRangeDropdown: React.FC<Props> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = PRESETS.find(p => p.key === value)?.label ?? 'Last 30 Days';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-1.5 bg-white border border-[#e2e8f0] text-[#45464d] text-[13px] font-medium rounded-full hover:bg-[#f8f9ff] transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">calendar_month</span>
        {currentLabel}
        <span className="material-symbols-outlined text-[14px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-44 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-1.5">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => { onChange(p.key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold rounded-lg transition-colors text-left"
              style={{
                background: p.key === value ? '#86f2e4' : 'transparent',
                color: p.key === value ? TEAL : '#64748b',
              }}
            >
              {p.key === value && <span className="material-symbols-outlined text-[14px]">check</span>}
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DateRangeDropdown;