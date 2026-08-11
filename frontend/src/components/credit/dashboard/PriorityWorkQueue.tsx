import React from 'react';
import { Link } from 'react-router-dom';

export interface PriorityWorkItem {
  id: string;
  applicationNo: string;
  borrowerName: string;
  state: string;
  requestedAmount: number | null;
  slaStatus: 'OK' | 'WARNING' | 'OVERDUE';
  slaRemainingHours: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface PriorityWorkQueueProps {
  items: PriorityWorkItem[];
  formatAmount: (value: number | null) => string;
  stateLabels: Record<string, string>;
  formatSla: (hours: number | null) => string;
}

const PRIORITY_COLOR: Record<PriorityWorkItem['priority'], string> = {
  HIGH: '#b42318',
  MEDIUM: '#b54708',
  LOW: '#344054',
};

const PriorityWorkQueue: React.FC<PriorityWorkQueueProps> = ({ items, formatAmount, stateLabels, formatSla }) => (
  <section aria-labelledby="credit-priority-queue-heading" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--cr-outline-variant)' }}>
      <h2 id="credit-priority-queue-heading" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--cr-on-surface)' }}>Priority Work Queue</h2>
      <Link to="/credit/applications?assignedToMe=true" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-secondary)', textDecoration: 'none' }}>View All</Link>
    </div>
    {items.length === 0 ? (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--cr-on-surface-variant)' }}>No assigned applications require action.</div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--cr-surface-container-low)' }}>
            {['Application', 'Borrower', 'Amount', 'Status', 'SLA', 'Priority'].map((heading) => <th key={heading} scope="col" style={{ textAlign: heading === 'Amount' ? 'right' : 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--cr-on-surface-variant)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{heading}</th>)}
          </tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--cr-outline-variant)' }}>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><Link to={`/credit/applications/${item.id}`} style={{ color: 'var(--cr-secondary)', fontWeight: 600, textDecoration: 'none' }}>{item.applicationNo}</Link></td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{item.borrowerName}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(item.requestedAmount)}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{stateLabels[item.state] ?? item.state}</td>
                <td style={{ padding: '10px 12px', color: item.slaStatus === 'OVERDUE' ? '#b42318' : item.slaStatus === 'WARNING' ? '#b54708' : 'var(--cr-on-surface-variant)', whiteSpace: 'nowrap' }}>{formatSla(item.slaRemainingHours)}</td>
                <td style={{ padding: '10px 12px', color: PRIORITY_COLOR[item.priority], fontWeight: 600, whiteSpace: 'nowrap' }}>{item.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default PriorityWorkQueue;
