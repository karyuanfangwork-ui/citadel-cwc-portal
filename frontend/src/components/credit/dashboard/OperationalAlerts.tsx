import React from 'react';
import { Link } from 'react-router-dom';

export interface OperationalAlert {
  title: string;
  icon: string;
  count: number;
  description: string;
  actionLabel: string;
  filterUrl: string;
  variant: 'danger' | 'warning' | 'info';
}

const COLORS = {
  danger: { text: '#b42318', background: '#fef3f2' },
  warning: { text: '#b54708', background: '#fffaeb' },
  info: { text: '#175cd3', background: '#eff8ff' },
};

const OperationalAlerts: React.FC<{ alerts: OperationalAlert[] }> = ({ alerts }) => (
  <section aria-labelledby="credit-operational-alerts-heading">
    <h2 id="credit-operational-alerts-heading" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>Operational alerts</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
      {alerts.map((alert) => {
        const color = COLORS[alert.variant];
        return <article key={alert.title} style={{ border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 16, background: 'var(--cr-surface-container-lowest)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: color.text }}><span className="material-symbols-outlined" aria-hidden="true">{alert.icon}</span><strong>{alert.title}</strong></div>
          <div style={{ fontSize: 24, fontWeight: 700, color: color.text, marginTop: 10 }}>{alert.count}</div>
          <p style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cr-on-surface-variant)', minHeight: 34 }}>{alert.description}</p>
          <Link to={alert.filterUrl} style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-secondary)' }}>{alert.actionLabel}</Link>
        </article>;
      })}
    </div>
  </section>
);

export default OperationalAlerts;
