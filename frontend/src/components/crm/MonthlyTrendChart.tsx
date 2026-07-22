import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface TrendItem {
  month: string;
  wonCount: number;
  wonValue: number;
  leadCount: number;
}

interface Props {
  data: TrendItem[];
}

const TEAL = '#006a61';
const BLUE = '#adc6ff';

const fmtValue = (value: number) => new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value);

const MonthlyTrendChart: React.FC<Props> = ({ data }) => {
  if (!data.length) {
    return <p className="text-xs text-[#45464d] opacity-60 text-center py-8">No trend data available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#45464d' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: '#45464d' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmtValue(v)}
          width={60}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10, fill: '#45464d' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0b1c30',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            color: '#fff',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'Revenue') return fmtValue(value);
            return `${value} leads`;
          }}
          labelStyle={{ color: '#86f2e4', fontWeight: 600 }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', paddingBottom: 8 }}
        />
        <Bar
          yAxisId="left"
          dataKey="wonValue"
          name="Revenue"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        >
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.wonValue === Math.max(...data.map(d => d.wonValue)) ? TEAL : '#80cbc4'}
            />
          ))}
        </Bar>
        <Bar
          yAxisId="right"
          dataKey="leadCount"
          name="Leads"
          fill={BLUE}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyTrendChart;