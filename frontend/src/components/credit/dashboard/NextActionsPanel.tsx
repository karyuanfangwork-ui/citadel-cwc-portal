import React from 'react';
import { Link } from 'react-router-dom';

interface NextActionItem {
  id: string;
  applicationNo: string;
  borrowerName: string;
  currentTask: string;
  nextAction: { label: string; route: string };
}

const NextActionsPanel: React.FC<{ items: NextActionItem[] }> = ({ items }) => (
  <section aria-labelledby="credit-next-actions-heading" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 20 }}>
    <h2 id="credit-next-actions-heading" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)', marginBottom: 12 }}>Next Actions</h2>
    {items.length === 0 ? <p style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)', margin: 0 }}>No next actions assigned.</p> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.slice(0, 5).map((item) => (
          <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--cr-outline-variant)' }}>
            <div style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)', marginBottom: 3 }}>{item.applicationNo} · {item.borrowerName}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--cr-on-surface)' }}>{item.currentTask}</span>
              <Link to={item.nextAction.route} style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-secondary)', whiteSpace: 'nowrap' }}>{item.nextAction.label}</Link>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default NextActionsPanel;
