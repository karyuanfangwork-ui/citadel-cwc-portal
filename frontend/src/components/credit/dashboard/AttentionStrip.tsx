import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardAttention } from '@/src/types/credit-ui.types';

interface AttentionStripProps {
  attention: DashboardAttention;
  onSelect?: (key: keyof DashboardAttention) => void;
  active?: keyof DashboardAttention | null;
}

const ITEMS: Array<{
  key: keyof DashboardAttention;
  label: string;
  icon: string;
  tone: 'danger' | 'warning' | 'info' | 'neutral';
  route: string;
}> = [
  { key: 'overdue', label: 'Overdue', icon: 'priority_high', tone: 'danger', route: '/credit/applications?quickFilter=overdue' },
  { key: 'dueSoon', label: 'Due soon', icon: 'schedule', tone: 'warning', route: '/credit/applications?quickFilter=dueSoon' },
  { key: 'informationRequired', label: 'Information required', icon: 'info', tone: 'info', route: '/credit/applications?quickFilter=informationRequired' },
  { key: 'returned', label: 'Returned', icon: 'undo', tone: 'neutral', route: '/credit/applications?quickFilter=returned' },
];

const TONE_STYLES: Record<typeof ITEMS[number]['tone'], { color: string; background: string }> = {
  danger: { color: '#b42318', background: '#fef3f2' },
  warning: { color: '#b54708', background: '#fffaeb' },
  info: { color: '#175cd3', background: '#eff8ff' },
  neutral: { color: '#344054', background: '#f2f4f7' },
};

const AttentionStrip: React.FC<AttentionStripProps> = ({ attention, onSelect, active }) => (
  <section aria-labelledby="credit-attention-heading" style={{ marginBottom: 24 }}>
    <h2 id="credit-attention-heading" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
      Attention requiring action
    </h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
      {ITEMS.map((item) => {
        const tone = TONE_STYLES[item.tone];
        return onSelect ? (
          <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-label={`${item.label}: ${attention[item.key]}`}
              aria-pressed={active === item.key}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: active === item.key ? tone.background : 'var(--cr-surface-container-lowest)', color: 'var(--cr-on-surface)', textDecoration: 'none', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ color: tone.color, background: tone.background, borderRadius: 999, padding: 6, fontSize: 18 }}>{item.icon}</span>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 20, lineHeight: 1.1, color: tone.color, fontVariantNumeric: 'tabular-nums' }}>{attention[item.key]}</strong>
                <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>{item.label}</span>
              </span>
            </button>
          ) : <Link
            key={item.key}
            to={item.route}
            aria-label={`${item.label}: ${attention[item.key]}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-lowest)', color: 'var(--cr-on-surface)', textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ color: tone.color, background: tone.background, borderRadius: 999, padding: 6, fontSize: 18 }}>{item.icon}</span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 20, lineHeight: 1.1, color: tone.color, fontVariantNumeric: 'tabular-nums' }}>{attention[item.key]}</strong>
              <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--cr-on-surface-variant)' }}>{item.label}</span>
            </span>
          </Link>;
      })}
    </div>
  </section>
);

export default AttentionStrip;
