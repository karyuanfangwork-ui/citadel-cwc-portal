import React from 'react';

interface FunnelItem {
  name: string;
  value: number;
}

interface Props {
  items: FunnelItem[];
  formatValue?: (value: number) => string;
}

const PipelineFunnelChart: React.FC<Props> = ({ items, formatValue }) => {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const fmt = formatValue ?? ((value: number) => new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value));

  if (items.length === 0) {
    return <p className="text-xs text-[var(--text-secondary,#6b7280)] text-center py-4">No pipeline data</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs gap-3">
            <span className="text-[var(--text-secondary,#6b7280)] font-medium">{item.name}</span>
            <span className="font-bold text-[var(--text-primary,#111827)]">{fmt(item.value)}</span>
          </div>
          <div className="w-full bg-[var(--bg-subtle,#f3f4f6)] rounded-full h-3 overflow-hidden">
            <div
              className="bg-brand-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((item.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PipelineFunnelChart;
