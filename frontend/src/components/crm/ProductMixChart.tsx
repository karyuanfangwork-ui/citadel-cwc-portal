import React from 'react';

interface Props {
  items: { name: string; value: number }[];
}

const COLORS = ['#2563eb', '#1e3a5f', '#3b82f6', '#93c5fd', '#bfdbfe', '#dbeafe'];

const ProductMixChart: React.FC<Props> = ({ items }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = items.map((item, index) => {
    const ratio = item.value / total;
    const dash = circumference * ratio;
    const segment = {
      ...item,
      color: COLORS[index % COLORS.length],
      dash,
      offset,
    };
    offset += dash;
    return segment;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="14" />
          {segments.map((segment) => (
            <circle
              key={segment.name}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={`${segment.dash} ${circumference}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-[var(--text-secondary,#6b7280)]">Total</span>
          <span className="text-lg font-bold text-[var(--text-primary,#111827)]">100%</span>
        </div>
      </div>
      <div className="w-full grid grid-cols-2 gap-y-1.5 gap-x-3">
        {segments.map((segment) => (
          <div key={segment.name} className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: segment.color }} />
            <span className="text-[11px] text-[var(--text-secondary,#6b7280)] truncate">{segment.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductMixChart;
