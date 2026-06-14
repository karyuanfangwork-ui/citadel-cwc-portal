import React from 'react';

interface TrendItem {
  month: string;
  wonCount: number;
  wonValue: number;
}

interface Props {
  data: TrendItem[];
}

const MonthlyTrendChart: React.FC<Props> = ({ data }) => {
  const maxValue = Math.max(...data.map((item) => item.wonValue), 1);
  const fmt = (value: number) => new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-end gap-3 pb-2 min-h-[160px]">
        {data.map((item) => {
          const heightPct = Math.max(Math.round((item.wonValue / maxValue) * 100), 4);
          const isHighest = item.wonValue === maxValue;
          return (
            <div
              key={item.month}
              className="flex-1 flex flex-col items-center justify-end group cursor-pointer"
              title={`${fmt(item.wonValue)} • ${item.wonCount} won`}
            >
              <div className="relative w-full">
                {isHighest && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--text-primary,#111827)] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {fmt(item.wonValue)}
                  </div>
                )}
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${isHighest ? 'bg-brand-600' : 'bg-[var(--bg-subtle,#e5e7eb)] group-hover:bg-brand-200'}`}
                  style={{ height: `${heightPct}%`, minHeight: '8px' }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between border-t border-[var(--border,#e5e7eb)] pt-2">
        {data.map((item) => (
          <span key={item.month} className="flex-1 text-center text-[11px] text-[var(--text-secondary,#6b7280)]">{item.month}</span>
        ))}
      </div>
    </div>
  );
};

export default MonthlyTrendChart;
